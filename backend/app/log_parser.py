import re
from datetime import datetime

from .models import LogEntry

SEVERITY_MAP = {
    "DEBUG": "DEBUG",
    "INFO": "INFO",
    "WARN": "WARN",
    "WARNING": "WARN",
    "ERROR": "ERROR",
    "CRITICAL": "CRITICAL",
    "FATAL": "CRITICAL",
}

LOG_LINE_REGEX = re.compile(
    (
        r"^(?P<timestamp>[0-9]{4}-[0-9]{2}-[0-9]{2}[T\s][0-9]{2}:[0-9]{2}:[0-9]{2}(?:[,\.][0-9]{3})?)?"
        r"\s*(?:\[(?P<subsystem>[^\]]+)\])?"
        r"\s*(?P<severity>DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL)?"
        r"[:\-\s]*"
        r"(?P<message>.*)$"
    ),
    re.IGNORECASE,
)


def normalize_severity(raw: str | None) -> str:
    if not raw:
        return "INFO"

    normalized = raw.strip().upper()
    return SEVERITY_MAP.get(normalized, normalized)


def parse_timestamp(raw: str | None) -> datetime | None:
    if not raw:
        return None

    normalized = raw.replace(",", ".")
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue
    return None


def parse_log_content(content: str) -> list[LogEntry]:
    entries: list[LogEntry] = []

    for line in content.splitlines():
        if not line.strip():
            continue

        match = LOG_LINE_REGEX.match(line)
        if not match:
            entries.append(
                LogEntry(
                    timestamp=None,
                    severity="INFO",
                    subsystem=None,
                    message=line.strip(),
                )
            )
            continue

        groups = match.groupdict()
        severity = normalize_severity(groups.get("severity"))
        timestamp = parse_timestamp(groups.get("timestamp"))
        subsystem = groups.get("subsystem")
        message = (groups.get("message") or line).strip()

        entries.append(
            LogEntry(
                timestamp=timestamp,
                severity=severity,
                subsystem=subsystem,
                message=message,
            )
        )

    return entries
