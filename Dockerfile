# Use Python 3.11 slim as base image
FROM python:3.11-slim

# Install curl for UV installation
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install build dependencies and create virtual environment
RUN apt-get update && \
    apt-get install -y python3-pip python3-venv build-essential && \
    python -m venv /app/venv && \
    rm -rf /var/lib/apt/lists/*

# Set environment variables
ENV PATH="/app/venv/bin:$PATH"
ENV VIRTUAL_ENV="/app/venv"

# Copy Python project files
COPY pyproject.toml ./

# Install dependencies using pip
RUN pip install --no-cache-dir -U pip && \
    pip install --no-cache-dir "crewai[tools]>=0.119.0,<1.0.0" && \
    pip install -e .

# Copy the rest of the application
COPY src/ ./src/

# Set Python path
ENV PYTHONPATH=/app

# Command to run the application
CMD ["python", "-m", "src.kyc_crew"]
