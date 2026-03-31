import os
import time
import uuid
import json
import logging
from datetime import date

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from openai import OpenAI, APIConnectionError, APIStatusError
from prometheus_client import (
    Counter,
    Histogram,
    generate_latest,
    CONTENT_TYPE_LATEST,
)

# ---------------------------------------------------------------------------
# Structured JSON logging
# ---------------------------------------------------------------------------

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname.lower(),
            "service": "nlp-service",
            "requestId": getattr(record, "requestId", ""),
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["error"] = {
                "name": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "stack": self.formatException(record.exc_info),
            }
        return json.dumps(log_entry)


handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter(datefmt="%Y-%m-%dT%H:%M:%S"))
logger = logging.getLogger("nlp-service")
logger.handlers = [handler]
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Prometheus metrics
# ---------------------------------------------------------------------------

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status"],
)
REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "path"],
    buckets=(0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120),
)
REQUEST_ERRORS = Counter(
    "http_request_errors_total",
    "Total HTTP request errors",
    ["method", "path"],
)

# ---------------------------------------------------------------------------
# OpenAI client
# ---------------------------------------------------------------------------

NLP_MODEL = os.environ.get("NLP_MODEL", "gpt-4")
_openai_client: OpenAI | None = None


def _get_openai_client() -> OpenAI:
    global _openai_client
    if _openai_client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable is not set")
        _openai_client = OpenAI(api_key=api_key)
    return _openai_client


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class DiarizedSegmentInput(BaseModel):
    startTime: float
    endTime: float
    text: str
    confidence: float
    speakerId: str
    speakerLabel: str
    speakerConfidence: float


class SpeakerInput(BaseModel):
    id: str
    label: str
    identifiedName: str | None = None


class TranscriptionInput(BaseModel):
    segments: list[DiarizedSegmentInput]
    speakers: list[SpeakerInput]
    language: str  # "es" | "en"


class SummaryResponse(BaseModel):
    topics: list[str]
    keyPoints: list[str]
    language: str


class ActionItemResponse(BaseModel):
    id: str
    description: str
    assignedTo: str
    assignedToLabel: str
    sourceSegmentId: str | None = None


class MinutesResponse(BaseModel):
    title: str
    date: str
    attendees: list[SpeakerInput]
    topicsDiscussed: list[str]
    decisions: list[str]
    actionItems: list[ActionItemResponse]
    language: str


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="NLP Service")


# ---------------------------------------------------------------------------
# Middleware – metrics collection
# ---------------------------------------------------------------------------

@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start

    path = request.url.path
    method = request.method
    status = str(response.status_code)

    REQUEST_COUNT.labels(method=method, path=path, status=status).inc()
    REQUEST_DURATION.labels(method=method, path=path).observe(elapsed)

    if response.status_code >= 400:
        REQUEST_ERRORS.labels(method=method, path=path).inc()

    return response


# ---------------------------------------------------------------------------
# Helper: call LLM with structured JSON output
# ---------------------------------------------------------------------------

def _build_transcript_text(data: TranscriptionInput) -> str:
    """Build a readable transcript from diarized segments."""
    lines: list[str] = []
    for seg in data.segments:
        lines.append(f"[{seg.speakerLabel}]: {seg.text}")
    return "\n".join(lines)


def _build_speaker_map(data: TranscriptionInput) -> dict[str, SpeakerInput]:
    """Map speakerId -> SpeakerInput for quick lookup."""
    return {s.id: s for s in data.speakers}


def _call_llm(system_prompt: str, user_prompt: str, request_id: str) -> str:
    """Call the OpenAI chat completion API. Raises HTTPException 503 on failure."""
    try:
        client = _get_openai_client()
        response = client.chat.completions.create(
            model=NLP_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        if content is None:
            raise HTTPException(status_code=503, detail="LLM returned empty response")
        return content
    except RuntimeError as exc:
        logger.error(
            f"OpenAI client not configured: {exc}",
            extra={"requestId": request_id},
        )
        raise HTTPException(status_code=503, detail="LLM service is not available")
    except APIConnectionError as exc:
        logger.error(
            f"OpenAI connection error: {exc}",
            extra={"requestId": request_id},
        )
        raise HTTPException(status_code=503, detail="LLM service is not available")
    except APIStatusError as exc:
        logger.error(
            f"OpenAI API error: {exc.status_code} {exc.message}",
            extra={"requestId": request_id},
        )
        raise HTTPException(status_code=503, detail="LLM service is not available")
    except Exception as exc:
        logger.error(
            f"Unexpected LLM error: {exc}",
            extra={"requestId": request_id},
            exc_info=True,
        )
        raise HTTPException(status_code=503, detail="LLM service is not available")


# ---------------------------------------------------------------------------
# POST /summary
# ---------------------------------------------------------------------------

@app.post("/summary", response_model=SummaryResponse)
async def generate_summary(data: TranscriptionInput):
    request_id = str(uuid.uuid4())
    logger.info(
        f"Generating summary for {len(data.segments)} segments, lang={data.language}",
        extra={"requestId": request_id},
    )

    transcript = _build_transcript_text(data)
    lang_instruction = (
        "Responde en español." if data.language == "es" else "Respond in English."
    )

    system_prompt = (
        "You are an expert meeting analyst. Extract the main topics and key points "
        "from the following meeting transcript. Return a JSON object with two arrays: "
        '"topics" (list of topic strings) and "keyPoints" (list of key point strings). '
        f"{lang_instruction}"
    )

    raw = _call_llm(system_prompt, transcript, request_id)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse LLM response as JSON", extra={"requestId": request_id})
        raise HTTPException(status_code=503, detail="LLM returned invalid response")

    topics = parsed.get("topics", [])
    key_points = parsed.get("keyPoints", parsed.get("key_points", []))

    # Ensure at least one topic
    if not topics:
        topics = ["General discussion"]

    return SummaryResponse(
        topics=topics,
        keyPoints=key_points,
        language=data.language,
    )


# ---------------------------------------------------------------------------
# POST /actions
# ---------------------------------------------------------------------------

@app.post("/actions", response_model=list[ActionItemResponse])
async def extract_actions(data: TranscriptionInput):
    request_id = str(uuid.uuid4())
    logger.info(
        f"Extracting action items for {len(data.segments)} segments, lang={data.language}",
        extra={"requestId": request_id},
    )

    transcript = _build_transcript_text(data)
    speaker_map = _build_speaker_map(data)

    speaker_list_str = ", ".join(
        f'{s.id} ("{s.label}"' + (f', name: "{s.identifiedName}"' if s.identifiedName else "") + ")"
        for s in data.speakers
    )

    lang_instruction = (
        "Responde en español." if data.language == "es" else "Respond in English."
    )

    system_prompt = (
        "You are an expert meeting analyst. Extract action items from the following "
        "meeting transcript. Each action item must be assigned to a speaker from the "
        "meeting. The available speakers are: " + speaker_list_str + ". "
        "Return a JSON object with an array called \"actionItems\". Each item must have: "
        '"description" (string), "assignedTo" (speakerId from the list, or "unassigned" '
        "if unclear), and optionally \"sourceSegmentId\" (null if not applicable). "
        f"{lang_instruction}"
    )

    raw = _call_llm(system_prompt, transcript, request_id)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse LLM response as JSON", extra={"requestId": request_id})
        raise HTTPException(status_code=503, detail="LLM returned invalid response")

    raw_items = parsed.get("actionItems", parsed.get("action_items", []))
    result: list[ActionItemResponse] = []

    for item in raw_items:
        assigned_to = item.get("assignedTo", item.get("assigned_to", "unassigned"))
        # Validate speaker reference
        if assigned_to not in speaker_map and assigned_to != "unassigned":
            assigned_to = "unassigned"

        if assigned_to == "unassigned":
            assigned_to_label = "Sin asignar" if data.language == "es" else "Unassigned"
        else:
            speaker = speaker_map.get(assigned_to)
            assigned_to_label = speaker.label if speaker else "Unknown"

        result.append(
            ActionItemResponse(
                id=str(uuid.uuid4()),
                description=item.get("description", ""),
                assignedTo=assigned_to,
                assignedToLabel=assigned_to_label,
                sourceSegmentId=item.get("sourceSegmentId", item.get("source_segment_id")),
            )
        )

    return result


# ---------------------------------------------------------------------------
# POST /minutes
# ---------------------------------------------------------------------------

@app.post("/minutes", response_model=MinutesResponse)
async def generate_minutes(data: TranscriptionInput):
    request_id = str(uuid.uuid4())
    logger.info(
        f"Generating formal minutes for {len(data.segments)} segments, lang={data.language}",
        extra={"requestId": request_id},
    )

    transcript = _build_transcript_text(data)
    speaker_map = _build_speaker_map(data)

    speaker_list_str = ", ".join(
        f'{s.id} ("{s.label}"' + (f', name: "{s.identifiedName}"' if s.identifiedName else "") + ")"
        for s in data.speakers
    )

    lang_instruction = (
        "Responde en español." if data.language == "es" else "Respond in English."
    )

    system_prompt = (
        "You are an expert meeting secretary. Generate formal meeting minutes from the "
        "following transcript. Return a JSON object with: "
        '"title" (string, a concise meeting title), '
        '"topicsDiscussed" (array of topic strings, must not be empty), '
        '"decisions" (array of decision strings, can be empty if no decisions were made), '
        '"actionItems" (array of objects with "description", "assignedTo" (speakerId or "unassigned"), '
        'and optionally "sourceSegmentId"). '
        "The available speakers are: " + speaker_list_str + ". "
        f"{lang_instruction}"
    )

    raw = _call_llm(system_prompt, transcript, request_id)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        logger.error(f"Failed to parse LLM response as JSON", extra={"requestId": request_id})
        raise HTTPException(status_code=503, detail="LLM returned invalid response")

    # Build attendees from speakers
    attendees = list(data.speakers)

    # Parse topics
    topics_discussed = parsed.get("topicsDiscussed", parsed.get("topics_discussed", []))
    if not topics_discussed:
        topics_discussed = ["General discussion"]

    # Parse decisions
    decisions = parsed.get("decisions", [])

    # Parse action items
    raw_actions = parsed.get("actionItems", parsed.get("action_items", []))
    action_items: list[ActionItemResponse] = []

    for item in raw_actions:
        assigned_to = item.get("assignedTo", item.get("assigned_to", "unassigned"))
        if assigned_to not in speaker_map and assigned_to != "unassigned":
            assigned_to = "unassigned"

        if assigned_to == "unassigned":
            assigned_to_label = "Sin asignar" if data.language == "es" else "Unassigned"
        else:
            speaker = speaker_map.get(assigned_to)
            assigned_to_label = speaker.label if speaker else "Unknown"

        action_items.append(
            ActionItemResponse(
                id=str(uuid.uuid4()),
                description=item.get("description", ""),
                assignedTo=assigned_to,
                assignedToLabel=assigned_to_label,
                sourceSegmentId=item.get("sourceSegmentId", item.get("source_segment_id")),
            )
        )

    title = parsed.get("title", "Meeting Minutes")

    return MinutesResponse(
        title=title,
        date=date.today().isoformat(),
        attendees=attendees,
        topicsDiscussed=topics_discussed,
        decisions=decisions,
        actionItems=action_items,
        language=data.language,
    )


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    api_key_set = bool(os.environ.get("OPENAI_API_KEY"))
    status = "healthy" if api_key_set else "degraded"
    return {"status": status, "model": NLP_MODEL, "api_key_configured": api_key_set}


# ---------------------------------------------------------------------------
# GET /metrics
# ---------------------------------------------------------------------------

@app.get("/metrics")
async def metrics():
    return PlainTextResponse(
        content=generate_latest().decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 4002))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, log_level="info")
