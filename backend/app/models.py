from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str


class LogEntry(BaseModel):
    timestamp: Optional[datetime] = Field(
        default=None,
        description="Parsed timestamp when available; may be None for unstructured lines.",
    )
    severity: str = Field(description="Normalized severity level (e.g., INFO, WARN, ERROR).")
    subsystem: Optional[str] = Field(default=None, description="Subsystem or source if present.")
    message: str = Field(description="Raw log message content.")


class ExtractedInsights(BaseModel):
    errors: List[str] = Field(default_factory=list)
    timeframes: List[str] = Field(default_factory=list)
    failed_actions: List[str] = Field(default_factory=list)
    system_failures: List[str] = Field(default_factory=list)
    agent_failures: List[str] = Field(default_factory=list)
    source: str = Field(
        default="heuristic",
        description="Indicates whether the insights came from the LLM or a fallback heuristic.",
    )


class LogAnalysisResponse(BaseModel):
    entries: List[LogEntry]
    insights: ExtractedInsights
    model: Optional[str] = Field(
        default=None, description="Model used to generate the insights when applicable."
    )
