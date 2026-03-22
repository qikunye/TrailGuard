FROM python:3.11-slim

ARG SERVICE
ENV SERVICE=${SERVICE}

WORKDIR /app
COPY atomic/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY wrappers/ .

CMD uvicorn ${SERVICE}:app --host 0.0.0.0 --port ${PORT:-8005}
