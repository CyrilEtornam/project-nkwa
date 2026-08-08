import os
import unittest

os.environ["USE_MOCK"] = "true"
os.environ["AWS_EC2_METADATA_DISABLED"] = "true"

from pydantic import ValidationError

from shared import bedrock_client
from shared.models import TriageDecision


class BedrockClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_mock_mode_does_not_create_aws_clients(self) -> None:
        triage = await bedrock_client.run_triage(
            "My brother is not breathing",
            "tw",
            5.6,
            -0.18,
            "AMBULANCE",
        )

        self.assertEqual(triage["severity"], "CRITICAL")
        self.assertIsNone(bedrock_client._bedrock_runtime)
        self.assertIsNone(bedrock_client._bedrock_agent_runtime)

    async def test_local_knowledge_fallback_returns_source(self) -> None:
        snippets = await bedrock_client.retrieve_first_aid_knowledge(
            "There is heavy bleeding after a road accident",
            {
                "severity": "CRITICAL",
                "incident_type": "Severe bleeding",
                "dispatcher_brief": "Heavy bleeding from trauma",
            },
            "AMBULANCE",
        )

        self.assertEqual(snippets[0].knowledge_source, "mock")
        self.assertTrue(snippets[0].source_id)
        self.assertIn("Steps:", snippets[0].text)

    async def test_mock_first_aid_guidance_is_grounded(self) -> None:
        guidance = await bedrock_client.generate_first_aid_guidance(
            "My brother is not breathing",
            "tw",
            {
                "severity": "CRITICAL",
                "incident_type": "Cardiac arrest",
                "dispatcher_brief": "Patient is not breathing",
            },
            "AMBULANCE",
        )

        self.assertEqual(guidance["knowledge_source"], "mock")
        self.assertTrue(guidance["first_aid_script"])
        self.assertTrue(guidance["knowledge_source_ids"])

    async def test_json_retry_repairs_malformed_model_text(self) -> None:
        calls = []
        original = bedrock_client._invoke_model_text

        async def fake_invoke(model_id, system_prompt, user_message, max_tokens):
            calls.append(user_message)
            if len(calls) == 1:
                return "not json"
            return '{"ok": true}'

        bedrock_client._invoke_model_text = fake_invoke
        try:
            payload = await bedrock_client._invoke_model_json("model", "system", "user", 10, "test")
        finally:
            bedrock_client._invoke_model_text = original

        self.assertEqual(payload, {"ok": True})
        self.assertEqual(len(calls), 2)

    def test_triage_schema_rejects_invalid_severity(self) -> None:
        with self.assertRaises(ValidationError):
            TriageDecision.model_validate({
                "severity": "LOW",
                "call_classification": "REAL_EMERGENCY",
                "incident_type": "Unknown",
                "is_prank": False,
                "prank_confidence": 0.0,
                "confidence": 0.8,
                "dispatcher_brief": "Invalid severity should not pass.",
                "recommended_response_unit": "AMBULANCE",
            })


if __name__ == "__main__":
    unittest.main()
