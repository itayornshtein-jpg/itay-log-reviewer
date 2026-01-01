import os
from typing import Annotated

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from .coralogix_client import CoralogixClient
from .llm_client import LogLLMClient
from .log_parser import parse_log_content
from .models import (
    CoralogixSearchResponse,
    ExtractedInsights,
    HealthResponse,
    LogAnalysisResponse,
)

app = FastAPI(title="Itay Log Reviewer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

llm_client = LogLLMClient()
coralogix_client = CoralogixClient()


@app.get("/health", response_model=HealthResponse)
def read_health() -> HealthResponse:
    """Simple health endpoint for readiness checks."""

    return HealthResponse(status="ok")


@app.post("/logs/upload", response_model=LogAnalysisResponse)
async def upload_logs(file: Annotated[UploadFile, File(...)]) -> LogAnalysisResponse:
    """Accept a log file, normalize entries, and extract insights."""

    allowed_extensions = {".log", ".txt", ".out", ".err"}
    _, ext = os.path.splitext(file.filename or "")
    if ext and ext.lower() not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unsupported file type '{ext}'. "
                "Please upload .log, .txt, .out, or .err files."
            ),
        )

    try:
        content_bytes = await file.read()
        content = content_bytes.decode("utf-8", errors="ignore")
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to read uploaded file.",
        ) from exc

    entries = parse_log_content(content)
    if not entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No log lines were found in the uploaded file.",
        )

    insights: ExtractedInsights = llm_client.analyze_logs(entries)
    return LogAnalysisResponse(
        entries=entries,
        insights=insights,
        model=llm_client.model if insights.source == "llm" else None,
    )


@app.get("/coralogix/logs", response_model=CoralogixSearchResponse)
def search_coralogix_logs(
    system: str | None = None,
    subsystem: str | None = None,
    query: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> CoralogixSearchResponse:
    """Proxy search requests to Coralogix with filter and pagination support."""

    try:
        results = coralogix_client.search_logs(
            system=system,
            subsystem=subsystem,
            query=query,
            page=page,
            page_size=page_size,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    return CoralogixSearchResponse.model_validate(results)
