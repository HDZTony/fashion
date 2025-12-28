# Multi-stage build to reduce image size
FROM python:3.12-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
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

# Clean up caches and unnecessary files to shrink image
RUN apt-get update \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /root/.cache \
    && find /root/.local -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true \
    && find /root/.local -type f -name "*.pyc" -delete \
    && find /root/.local -type f -name "*.pyo" -delete

# Verify uvicorn is installed and accessible
RUN /root/.local/bin/uvicorn --version || python -m uvicorn --version || (echo "ERROR: uvicorn not found" && exit 1)

# Expose port 8000
EXPOSE 8000

# Run uvicorn when the container launches
# 增加超时设置以支持大图片上传和处理（下载、上传到R2、AI分析等）
# 使用单进程模式（适合 Fly.io），确保日志输出，监听所有网络接口
# Use full path to uvicorn to ensure it's found
CMD ["/root/.local/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--log-level", "info", "--timeout-keep-alive", "300", "--timeout-graceful-shutdown", "30"]
