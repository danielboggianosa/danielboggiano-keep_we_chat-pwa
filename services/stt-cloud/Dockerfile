# Stage 1: Install dependencies
FROM python:3.11-slim AS deps

WORKDIR /app

# System deps required by whisper (ffmpeg for audio decoding)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg git && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-build-isolation --no-cache-dir openai-whisper==20240930

# Stage 2: Production runtime
FROM python:3.11-slim

WORKDIR /app

# ffmpeg is required at runtime for Whisper audio loading
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r appgroup && useradd -r -g appgroup appuser

COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

COPY src/ ./src/

# Whisper model cache directory (writable by appuser)
RUN mkdir -p /home/appuser/.cache && chown -R appuser:appgroup /home/appuser

USER appuser

ENV PORT=4001
ENV WHISPER_MODEL=base

EXPOSE 4001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:4001/health')" || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "4001"]
