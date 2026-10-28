# ==============================================================================
# UK Wind Forecast Analysis - Backend Dockerfile
# Production-ready Python FastAPI ASGI container with non-root security & health checks
# ==============================================================================

FROM python:3.11-slim

# Prevent Python from writing .pyc files to disk and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0

# Install curl for container health check & cleanup apt cache to minimize image size
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Create dedicated non-root application user
RUN useradd --create-home --no-log-init --shell /bin/bash appuser

WORKDIR /app

# Install Python dependencies leveraging Docker layer caching
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code and set ownership
COPY --chown=appuser:appuser . /app

# Switch to non-root user
USER appuser

# Expose backend port
EXPOSE 8000

# Container healthcheck using backend /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Launch production ASGI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
