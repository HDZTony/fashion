# Multi-stage build to reduce image size
FROM python:3.12-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy requirements and install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir --user --extra-index-url https://download.pytorch.org/whl/cpu . \
    && rm -rf /root/.cache/pip

FROM n0computer/iroh-relay:latest AS iroh_relay

# Final stage
FROM python:3.12-slim

WORKDIR /app

COPY --from=builder /root/.local /root/.local
COPY --from=iroh_relay /iroh-relay /iroh-relay
COPY . .
COPY iroh-relay.toml /config/iroh-relay.toml
COPY scripts/fly-start.sh /app/scripts/fly-start.sh

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV HF_ENDPOINT=https://hf-mirror.com

RUN apt-get update \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /root/.cache \
    && find /root/.local -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true \
    && find /root/.local -type f -name "*.pyc" -delete \
    && find /root/.local -type f -name "*.pyo" -delete \
    && sed -i 's/\r$//' /app/scripts/fly-start.sh \
    && chmod +x /app/scripts/fly-start.sh \
    && /root/.local/bin/uvicorn --version || python -m uvicorn --version || (echo "ERROR: uvicorn not found" && exit 1)

EXPOSE 8000 3340

CMD ["/app/scripts/fly-start.sh"]
