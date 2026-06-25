import base64
import os
import unittest

os.environ["USE_MOCK"] = "true"
os.environ["AWS_EC2_METADATA_DISABLED"] = "true"

from fastapi.testclient import TestClient

from main import app
from shared import dynamo_client


class MainTests(unittest.TestCase):
    def setUp(self) -> None:
        dynamo_client._MOCK_DB.clear()
        self.client = TestClient(app)

    def test_health_check(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "ok")
        self.assertIn("timestamp", body)

    def test_mock_call_pipeline_saves_bedrock_knowledge_fields(self) -> None:
        audio = base64.b64encode(b"RIFFmock-wav-data").decode("ascii")
        response = self.client.post(
            "/api/v1/calls/initiate",
            json={
                "service_type": "AMBULANCE",
                "language": "tw",
                "gps_lat": 5.6037,
                "gps_lon": -0.1870,
                "audio_base64": audio,
            },
        )

        self.assertEqual(response.status_code, 202)
        body = response.json()
        self.assertEqual(body["status"], "PROCESSING")
        self.assertTrue(body["first_aid_audio_url"])

        detail = self.client.get(f"/api/v1/calls/{body['call_id']}")
        self.assertEqual(detail.status_code, 200)
        item = detail.json()
        self.assertEqual(item["severity"], "CRITICAL")
        self.assertEqual(item["knowledge_source"], "mock")
        self.assertTrue(item["knowledge_source_ids"])
        self.assertEqual(item["triage_model_id"], "us.anthropic.claude-opus-4-6-v1")
        self.assertEqual(item["first_aid_model_id"], "us.anthropic.claude-sonnet-4-6")


if __name__ == "__main__":
    unittest.main()
