# Python 3.11 base image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for OpenCV and MediaPipe
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy src directory
COPY app.py .
COPY src/ ./src/

# Expose port
EXPOSE 8501

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8501/_stcore/health', timeout=5)" || exit 1

# Run Streamlit
CMD ["streamlit", "run", "app.py", "--server.port", "8501", "--server.address", "0.0.0.0"]