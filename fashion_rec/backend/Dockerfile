# Multi-stage build to reduce image size
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy requirements and install dependencies
# Copy pyproject.toml and install dependencies
COPY pyproject.toml .
RUN pip install --no-cache-dir --user .

# Final stage
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy only the installed packages from builder
COPY --from=builder /root/.local /root/.local

# Copy application code
COPY . .

# Make sure scripts in .local are usable
ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

# Set Hugging Face mirror to avoid SSL issues
ENV HF_ENDPOINT=https://hf-mirror.com

# Pre-download CLIP model during build to avoid download on first run
# This makes deployment faster and more reliable
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('clip-ViT-B-32')" || \
    echo "Warning: Failed to pre-download model, will download on first run"

# Clean up pip cache and unnecessary files
RUN apt-get update \
    && rm -rf /var/lib/apt/lists/* \
    && find /root/.local -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true \
    && find /root/.local -type f -name "*.pyc" -delete \
    && find /root/.local -type f -name "*.pyo" -delete

# Expose port 8000
EXPOSE 8000

# Run uvicorn when the container launches
# 增加超时设置以支持大图片上传和处理（下载、上传到R2、AI分析等）
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "300", "--timeout-graceful-shutdown", "30"]
