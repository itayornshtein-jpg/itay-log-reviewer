"""Lightweight client for querying Coralogix logs."""

from __future__ import annotations

import contextlib
import os
from dataclasses import dataclass
from typing import Any

import httpx


@dataclass
class CoralogixSettings:
    """Runtime configuration for Coralogix connectivity."""

    api_key: str | None
    base_url: str
    webhook_url: str | None

    @classmethod
    def from_env(cls) -> CoralogixSettings:
        return cls(
            api_key=os.getenv("cxup_xbBqkzrmz33N1etfgSVeV5ycOkC0zc"),
            base_url=os.getenv("CORALOGIX_BASE_URL", "https://api.coralogix.com/api/v1"),
            webhook_url=os.getenv("https://api.eu2.coralogix.com/api/v1/external/rule/rule-set"),
        )


@dataclass
class CoralogixSearchOptions:
    """User-supplied filters and pagination for Coralogix queries."""

    system: str | None = None
    subsystem: str | None = None
    query: str | None = None
    page: int = 1
    page_size: int = 50


class CoralogixClient:
    """Minimal wrapper around Coralogix search endpoints."""

    def __init__(
        self,
        settings: CoralogixSettings | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        self.settings = settings or CoralogixSettings.from_env()
        self._http_client = http_client or httpx.Client(timeout=10)

    def _build_query(self, system: str | None, subsystem: str | None, query: str | None) -> str:
        parts: list[str] = []
        if system:
            parts.append(f'system:"{system}"')
        if subsystem:
            parts.append(f'subsystem:"{subsystem}"')
        if query:
            parts.append(query)
        if not parts:
            return "*"
        return " AND ".join(parts)

    def search_logs(
        self,
        *,
        options: CoralogixSearchOptions | None = None,
    ) -> dict[str, Any]:
        options = options or CoralogixSearchOptions()
        if not self.settings.api_key:
            msg = "Coralogix API key is not configured."
            raise RuntimeError(msg)

        if options.page < 1 or options.page_size < 1:
            msg = "page and page_size must be positive integers"
            raise ValueError(msg)

        body = {
            "query": self._build_query(options.system, options.subsystem, options.query),
            "page": options.page,
            "pageSize": options.page_size,
        }

        response = self._http_client.post(
            f"{self.settings.base_url.rstrip('/')}/logs/search",
            headers={"Authorization": f"Bearer {self.settings.api_key}"},
            json=body,
        )

        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:  # pragma: no cover - transport error handling
            msg = exc.response.text
            if exc.response.headers.get("Content-Type", "").startswith("application/json"):
                with contextlib.suppress(Exception):  # pragma: no cover - best effort parsing
                    msg = exc.response.json().get("message", msg)
            raise RuntimeError(msg or "Failed to query Coralogix") from exc

        data = response.json()
        logs = data.get("logs") or data.get("data", {}).get("logs") or []

        normalized_logs = [
            {
                "timestamp": log.get("timestamp") or log.get("time") or log.get("occurredAt"),
                "severity": log.get("severity") or log.get("level"),
                "system": log.get("system"),
                "subsystem": log.get("subsystem"),
                "message": log.get("message") or log.get("text") or log.get("description"),
                "raw": log,
            }
            for log in logs
        ]

        return {
            "entries": normalized_logs,
            "page": data.get("page", options.page),
            "page_size": data.get("pageSize", options.page_size),
            "total": data.get("total", data.get("totalHits", len(normalized_logs))),
            "webhook_url": self.settings.webhook_url,
        }

