FROM python:3.12-slim

RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY backend/tests ./tests
COPY config ./config
COPY pyproject.toml ./pyproject.toml

RUN chown -R appuser:appuser /app
USER appuser

ENTRYPOINT ["python"]
CMD ["-m", "uvicorn", "app.server:app", "--host", "0.0.0.0", "--port", "8000"]