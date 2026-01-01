from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Itay Log Reviewer API")


class HealthResponse(BaseModel):
    status: str


@app.get("/health", response_model=HealthResponse)
def read_health() -> HealthResponse:
    """Simple health endpoint for readiness checks."""

    return HealthResponse(status="ok")
