# Fund X-Ray API image for Google Cloud Run.
# Build from the repo root (the engine package lives beside api/):
#   docker build -f api/Dockerfile -t fund-xray-api .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /srv

# Dependencies first so code-only changes rebuild fast
COPY engine ./engine
COPY api/requirements.txt ./api/requirements.txt
RUN pip install -r api/requirements.txt

COPY api ./api
WORKDIR /srv/api

# Run as a non-root user
RUN useradd --system --no-create-home app
USER app

# Cloud Run sets $PORT (8080 by default)
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips="*"
