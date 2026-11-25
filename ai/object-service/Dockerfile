FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 TORCH_HOME=/models
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
# GPU=1 installs the CUDA build of torch/torchvision (large image) instead of the CPU one
ARG GPU=0
RUN if [ "$GPU" = "1" ]; then \
      grep -v -e '^--extra-index-url' -e '^torch' requirements.txt > /tmp/req.txt \
      && pip install --no-cache-dir -r /tmp/req.txt \
      && pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu124 "torch>=2.3" "torchvision>=0.18"; \
    else pip install --no-cache-dir -r requirements.txt; fi
COPY app app
EXPOSE 8091
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8091/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8091", "--workers", "1"]
