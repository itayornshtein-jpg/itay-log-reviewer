import json
import os
from typing import List, Optional

from openai import OpenAI

from .models import ExtractedInsights, LogEntry


class LogLLMClient:
    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.model = model
        self.api_key = os.getenv("OPENAI_API_KEY")
        self._client: Optional[OpenAI] = None
        if self.api_key:
            self._client = OpenAI(api_key=self.api_key)

    def _build_prompt(self, entries: List[LogEntry]) -> str:
        lines = []
        for entry in entries:
            timestamp = entry.timestamp.isoformat() if entry.timestamp else "(no timestamp)"
            subsystem = f"[{entry.subsystem}] " if entry.subsystem else ""
            lines.append(f"{timestamp} {subsystem}{entry.severity}: {entry.message}")

        return (
            "Analyze the following log entries. Identify distinct errors, important timeframes, failed "
            "actions, and failures caused by the system versus agents. Return a JSON object with keys: "
            "errors (list), timeframes (list), failed_actions (list), system_failures (list), agent_failures (list). "
            "Keep answers concise. Logs:\n" + "\n".join(lines)
        )

    def analyze_logs(self, entries: List[LogEntry]) -> ExtractedInsights:
        if not self.api_key or not self._client:
            return self._heuristic_insights(entries)

        prompt = self._build_prompt(entries)
        try:
            response = self._client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a log analysis assistant."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )
        except Exception:
            return self._heuristic_insights(entries)

        content = response.choices[0].message.content if response.choices else None
        if not content:
            return self._heuristic_insights(entries)

        try:
            payload = json.loads(content)
        except json.JSONDecodeError:
            return self._heuristic_insights(entries)

        return ExtractedInsights(
            errors=payload.get("errors", []),
            timeframes=payload.get("timeframes", []),
            failed_actions=payload.get("failed_actions", []),
            system_failures=payload.get("system_failures", []),
            agent_failures=payload.get("agent_failures", []),
            source="llm",
        )

    def _heuristic_insights(self, entries: List[LogEntry]) -> ExtractedInsights:
        errors = [f"{e.severity}: {e.message}" for e in entries if e.severity in {"ERROR", "CRITICAL"}]
        failed_actions = [e.message for e in entries if "fail" in e.message.lower()]

        timestamps = [e.timestamp for e in entries if e.timestamp]
        timeframes: List[str] = []
        if timestamps:
            start, end = min(timestamps), max(timestamps)
            timeframes.append(f"Activity spans from {start.isoformat()} to {end.isoformat()}.")

        system_failures = [
            e.message for e in entries if any(keyword in e.message.lower() for keyword in ("system", "server", "service"))
        ]
        agent_failures = [
            e.message
            for e in entries
            if any(keyword in e.message.lower() for keyword in ("agent", "worker", "client"))
        ]

        return ExtractedInsights(
            errors=errors[:10],
            timeframes=timeframes,
            failed_actions=failed_actions[:10],
            system_failures=system_failures[:10],
            agent_failures=agent_failures[:10],
            source="heuristic",
        )
