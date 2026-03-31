import os
import time
import uuid
import logging
import tempfile
import json
from contextlib import asynccontextmanager

import whisper
import torch
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
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
            "service": "stt-cloud",
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
logger = logging.getLogger("stt-cloud")
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
# Supported audio formats (MIME type -> file extension)
# ---------------------------------------------------------------------------
SUPPORTED_FORMATS: dict[str, str] = {
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/wave": ".wav",
    "audio/webm": ".webm",
    "audio/ogg": ".ogg",
    "application/ogg": ".ogg",
}

SUPPORTED_LANGUAGES = {"es", "en"}

# ---------------------------------------------------------------------------
# Whisper model loading (at startup)
# ---------------------------------------------------------------------------
_whisper_model: whisper.Whisper | None = None


def _load_model() -> whisper.Whisper:
    model_name = os.environ.get("WHISPER_MODEL", "base")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info(f"Loading Whisper model '{model_name}' on {device}")
    model = whisper.load_model(model_name, device=device)
    logger.info("Whisper model loaded successfully")
    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _whisper_model
    _whisper_model = _load_model()
    yield


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="STT Cloud Service", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------
class TranscriptionSegment(BaseModel):
    startTime: float
    endTime: float
    text: str
    confidence: float


class TranscriptionResponse(BaseModel):
    segments: list[TranscriptionSegment]
    language: str
    duration: float


# ---------------------------------------------------------------------------
# Middleware – metrics collection
# ---------------------------------------------------------------------------
@app.middleware("http")
async def metrics_middleware(request, call_next):
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
# POST /transcribe
# ---------------------------------------------------------------------------
@app.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe(
    file: UploadFile = File(...),
    language: str | None = Form(default=None),
):
    request_id = str(uuid.uuid4())

    # --- Validate content type ---
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type not in SUPPORTED_FORMATS:
        logger.warning(
            f"Unsupported format: {content_type}",
            extra={"requestId": request_id},
        )
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format: {content_type}. Supported: WAV, WebM, OGG",
        )

    # --- Validate language if provided ---
    if language is not None and language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language: {language}. Supported: es, en",
        )

    # --- Write to temp file for Whisper ---
    ext = SUPPORTED_FORMATS[content_type]
    try:
        audio_bytes = await file.read()
        if len(audio_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file")

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            f"Failed to read uploaded file: {exc}",
            extra={"requestId": request_id},
        )
        raise HTTPException(status_code=400, detail="Corrupt or unreadable audio file")

    # --- Run Whisper transcription ---
    try:
        whisper_opts: dict = {"fp16": torch.cuda.is_available()}
        if language is not None:
            whisper_opts["language"] = language

        result = _whisper_model.transcribe(tmp_path, **whisper_opts)
    except Exception as exc:
        logger.error(
            f"Whisper transcription failed: {exc}",
            extra={"requestId": request_id},
            exc_info=True,
        )
        raise HTTPException(status_code=400, detail="Failed to transcribe audio – file may be corrupt")
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    # --- Build response ---
    detected_language = result.get("language", "en")
    # Map full language names to ISO codes if needed
    lang_map = {"spanish": "es", "english": "en"}
    detected_language = lang_map.get(detected_language, detected_language)

    segments: list[TranscriptionSegment] = []
    for seg in result.get("segments", []):
        start_time = float(seg.get("start", 0.0))
        end_time = float(seg.get("end", 0.0))
        text = seg.get("text", "").strip()
        # Whisper doesn't provide per-segment confidence directly;
        # use avg_logprob as a proxy, mapped to 0-1 range
        avg_logprob = seg.get("avg_logprob", -0.5)
        no_speech_prob = seg.get("no_speech_prob", 0.0)
        # Heuristic: convert log-prob to a 0-1 confidence score
        confidence = max(0.0, min(1.0, 1.0 + avg_logprob))
        # Penalise high no-speech probability
        confidence *= 1.0 - no_speech_prob

        if text:
            segments.append(
                TranscriptionSegment(
                    startTime=round(start_time, 3),
                    endTime=round(end_time, 3),
                    text=text,
                    confidence=round(max(0.0, min(1.0, confidence)), 4),
                )
            )

    # Duration: use the last segment end time or Whisper's reported duration
    duration = 0.0
    if segments:
        duration = segments[-1].endTime
    # Whisper may also report duration in the result dict
    if "duration" in result:
        duration = float(result["duration"])

    logger.info(
        f"Transcription complete: {len(segments)} segments, lang={detected_language}, duration={duration}s",
        extra={"requestId": request_id},
    )

    return TranscriptionResponse(
        segments=segments,
        language=detected_language,
        duration=round(duration, 3),
    )


# ---------------------------------------------------------------------------
# GET /health
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    model_loaded = _whisper_model is not None
    return {"status": "healthy" if model_loaded else "degraded", "model_loaded": model_loaded}


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

    port = int(os.environ.get("PORT", 4001))
    uvicorn.run("src.main:app", host="0.0.0.0", port=port, log_level="info")
