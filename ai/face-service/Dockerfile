FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 INSIGHTFACE_HOME=/models
RUN apt-get update && apt-get install -y --no-install-recommends build-essential g++ libgl1 libglib2.0-0 wget \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app app
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8090/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090", "--workers", "1"]
