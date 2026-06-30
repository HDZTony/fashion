# Wormhole iroh-relay sidecar binary (same Machine as FastAPI to save Fly VM cost)
FROM n0computer/iroh-relay:latest AS iroh_relay

# Multi-stage build to reduce image size
FROM python:3.12-slim as builder

# Install build dependencies (git required for hdz-auth git dependency in pyproject.toml)
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy requirements and install dependencies
# Copy pyproject.toml and install dependencies
COPY pyproject.toml .
# Install with CPU wheels and no cache to keep image small
RUN pip install --no-cache-dir --user --extra-index-url https://download.pytorch.org/whl/cpu . \
    && rm -rf /root/.cache/pip

# Final stage
FROM python:3.12-slim

# Tailscale (userspace) so Fly backend can reach LocateAnything on tailnet (100.x)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://tailscale.com/install.sh | sh \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy only the installed packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY . .

COPY --from=iroh_relay /iroh-relay /usr/local/bin/iroh-relay
COPY config/iroh-relay.toml /etc/wormhole/iroh-relay.toml

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

# Set Hugging Face mirror to avoid SSL issues
ENV HF_ENDPOINT=https://hf-mirror.com

# Clean up caches and unnecessary files to shrink image
RUN apt-get update \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /root/.cache \
    && find /root/.local -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true \
    && find /root/.local -type f -name "*.pyc" -delete \
    && find /root/.local -type f -name "*.pyo" -delete

# Verify uvicorn is installed and accessible
RUN /root/.local/bin/uvicorn --version || python -m uvicorn --version || (echo "ERROR: uvicorn not found" && exit 1)

# FastAPI 8000; Wormhole iroh-relay 3340 (Fly [[services]] maps public 3340)
EXPOSE 8000 3340 9090

COPY scripts/fly-start.sh /fly-start.sh
# Strip Windows CRLF so Linux init can exec the shebang (Fly logs: "No such file or directory")
RUN sed -i 's/\r$//' /fly-start.sh && chmod +x /fly-start.sh

# fly-start.sh: optional Tailscale (TAILSCALE_AUTHKEY) + uvicorn
CMD ["/bin/sh", "/fly-start.sh"]
