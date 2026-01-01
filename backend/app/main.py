from io import BytesIO
from typing import Annotated
from zipfile import BadZipFile, ZipFile

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware

from .coralogix_client import CoralogixClient, CoralogixSearchOptions
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


async def _extract_file_contents(file: UploadFile) -> list[str]:
    """Return decoded text contents from supported uploads.

    Supports raw text-based log files and zip archives that contain log files.
    """

    filename = file.filename or "uploaded_file"

    try:
        content_bytes = await file.read()
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to read uploaded file '{filename}'.",
        ) from exc

    try:
        with ZipFile(BytesIO(content_bytes)) as archive:
            contents: list[str] = []
            for info in archive.infolist():
                if info.is_dir():
                    continue

                with archive.open(info) as member:
                    contents.append(member.read().decode("utf-8", errors="ignore"))

            if contents:
                return contents

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Uploaded zip archive '{filename}' contained no readable files.",
            )
    except BadZipFile:
        # Not a zip file; fall back to reading as plain text.
        pass

    return [content_bytes.decode("utf-8", errors="ignore")]


@app.post("/logs/upload", response_model=LogAnalysisResponse)
async def upload_logs(files: Annotated[list[UploadFile], File(...)]) -> LogAnalysisResponse:
    """Accept uploaded logs, normalize entries, and extract insights."""

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload at least one file.",
        )

    contents: list[str] = []
    for file in files:
        contents.extend(await _extract_file_contents(file))

    parsed_entries = []
    for content in contents:
        parsed_entries.extend(parse_log_content(content))

    if not parsed_entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No log lines were found in the uploaded files.",
        )

    insights: ExtractedInsights = llm_client.analyze_logs(parsed_entries)
    return LogAnalysisResponse(
        entries=parsed_entries,
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

    options = CoralogixSearchOptions(
        system=system, subsystem=subsystem, query=query, page=page, page_size=page_size
    )

    try:
        results = coralogix_client.search_logs(options=options)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    return CoralogixSearchResponse.model_validate(results)
