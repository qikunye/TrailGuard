FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY Trail_Safety_Assessment_Flask.py .
CMD python Trail_Safety_Assessment_Flask.py
