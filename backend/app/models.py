from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str


class LogEntry(BaseModel):
    timestamp: datetime | None = Field(
        default=None,
        description="Parsed timestamp when available; may be None for unstructured lines.",
    )
    severity: str = Field(description="Normalized severity level (e.g., INFO, WARN, ERROR).")
    subsystem: str | None = Field(default=None, description="Subsystem or source if present.")
    message: str = Field(description="Raw log message content.")


class ExtractedInsights(BaseModel):
    errors: list[str] = Field(default_factory=list)
    timeframes: list[str] = Field(default_factory=list)
    failed_actions: list[str] = Field(default_factory=list)
    system_failures: list[str] = Field(default_factory=list)
    agent_failures: list[str] = Field(default_factory=list)
    source: str = Field(
        default="heuristic",
        description="Indicates whether the insights came from the LLM or a fallback heuristic.",
    )


class LogAnalysisResponse(BaseModel):
    entries: list[LogEntry]
    insights: ExtractedInsights
    model: str | None = Field(
        default=None, description="Model used to generate the insights when applicable."
    )
