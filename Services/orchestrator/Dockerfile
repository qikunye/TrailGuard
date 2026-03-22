FROM python:3.11-slim
WORKDIR /app
COPY atomic/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY orchestrator/ .
CMD uvicorn Trail_Safety_Assessment_Service:app --host 0.0.0.0 --port ${PORT:-8000}
