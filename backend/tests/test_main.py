from io import BytesIO
from zipfile import ZipFile

from fastapi.testclient import TestClient

from app.log_parser import parse_log_content
from app.main import app


client = TestClient(app)


SAMPLE_LOG = """
2024-06-01 10:00:00,123 [auth] INFO: User login attempt
2024-06-01 10:00:01,500 [auth] ERROR: Authentication failed for user alice
2024-06-01 10:00:02 [db] WARN: Connection retry
""".strip()


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
def test_upload_logs_heuristic_path():
    files = [("files", ("sample.log", BytesIO(SAMPLE_LOG.encode()), "text/plain"))]

    response = client.post("/logs/upload", files=files)

    assert response.status_code == 200
    payload = response.json()

    assert payload["entries"][1]["severity"] == "ERROR"
    assert payload["entries"][0]["subsystem"] == "auth"
    assert payload["insights"]["source"] == "heuristic"
    assert payload["insights"]["errors"]
    assert payload["insights"]["failed_actions"]


def test_upload_zip_with_logs():
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr("inner/sample.log", SAMPLE_LOG)

    buffer.seek(0)
    files = [("files", ("bundle.zip", buffer, "application/zip"))]

    response = client.post("/logs/upload", files=files)

    assert response.status_code == 200
    payload = response.json()

    assert len(payload["entries"]) == 3
    assert payload["entries"][1]["severity"] == "ERROR"


def test_upload_logs_any_extension():
    files = [("files", ("events.json", BytesIO(SAMPLE_LOG.encode()), "application/json"))]

    response = client.post("/logs/upload", files=files)

    assert response.status_code == 200
    payload = response.json()

    assert payload["entries"][0]["subsystem"] == "auth"
    assert payload["entries"][1]["severity"] == "ERROR"


def test_upload_zip_with_mixed_extensions():
    buffer = BytesIO()
    with ZipFile(buffer, "w") as archive:
        archive.writestr("inner/data.json", SAMPLE_LOG)
        archive.writestr("inner/notes.txt", SAMPLE_LOG)

    buffer.seek(0)
    files = [("files", ("bundle.bin", buffer, "application/octet-stream"))]

    response = client.post("/logs/upload", files=files)

    assert response.status_code == 200
    payload = response.json()

    assert len(payload["entries"]) == 6
    assert payload["entries"][3]["subsystem"] == "auth"


def test_parse_log_content_round_trip():
    entries = parse_log_content(SAMPLE_LOG)

    assert len(entries) == 3
    assert entries[0].timestamp and entries[0].timestamp.isoformat().startswith("2024-06-01")
    assert entries[1].severity == "ERROR"
    assert entries[2].subsystem == "db"
