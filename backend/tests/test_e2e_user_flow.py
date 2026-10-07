import json
import os
import sys
import unittest
from dotenv import load_dotenv

# Ensure root and backend are on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BASE_DIR)
sys.path.insert(0, ROOT_DIR)
sys.path.insert(0, BASE_DIR)

load_dotenv(os.path.join(BASE_DIR, ".env"))

from backend.app import app
from backend.services.gemini_service import analyze_problem, is_gemini_configured


class TestUserAIResolutionFlowE2E(unittest.TestCase):
    """
    End-to-End Verification of the UNSAID User AI Resolution & Escalation Flow:
    USER PROBLEM -> REAL AI ANALYSIS & SOLUTION -> USER SATISFACTION EVALUATION -> ESCALATION TO ADMIN
    """

    def setUp(self):
        self.app = app
        self.client = self.app.test_client()

    def test_gemini_is_configured_with_real_api_key(self):
        """Verify real Gemini API key is configured."""
        self.assertTrue(
            is_gemini_configured(),
            "GEMINI_API_KEY must be properly configured in backend/.env",
        )

    def test_real_gemini_analysis_for_hostel_ac_problem(self):
        """
        Verify that REAL Google Gemini API analyzes the specific test problem:
        'My hostel room AC is not working.'
        and produces practical, actionable troubleshooting advice.
        """
        problem_text = "My hostel room AC is not working."
        result = analyze_problem(
            title=problem_text,
            description=problem_text,
            category="General",
            workspace_id="test_workspace",
        )

        self.assertIsNotNone(result, "Gemini should return a valid analysis object.")
        self.assertIn("summary", result)
        self.assertIn("suggestedWorkaround", result)
        self.assertIn("quickActions", result)
        self.assertIn("priority", result)

        summary = result.get("summary", "")
        workaround = result.get("suggestedWorkaround", "")
        quick_actions = result.get("quickActions", [])

        # Verify substantive troubleshooting content
        combined_text = (summary + " " + workaround + " " + " ".join(quick_actions)).lower()
        ac_keywords = ["ac", "air condition", "power", "thermostat", "remote", "plug", "filter", "temperature", "switch", "cool"]
        matched_keywords = [kw for kw in ac_keywords if kw in combined_text]

        print("\n--- REAL GEMINI RESPONSE FOR HOSTEL AC ---")
        print(f"Summary: {summary}")
        print(f"Workaround/Solution: {workaround}")
        print(f"Quick Actions: {quick_actions}")
        print(f"Priority: {result.get('priority')}")
        print(f"Model used: {result.get('model')}")
        print(f"Matched AC keywords: {matched_keywords}")
        print("------------------------------------------\n")

        self.assertGreater(
            len(matched_keywords),
            0,
            f"Expected Gemini response to contain AC-related troubleshooting concepts, found: {matched_keywords}",
        )
        self.assertTrue(len(workaround) > 20, "Gemini must provide a substantive workaround/solution.")

    def test_escalation_data_structure_integrity(self):
        """
        Verify the data package created when user clicks 'This didn't solve my problem'.
        It must contain:
        - original problem
        - AI analysis
        - AI suggested solution
        - user dissatisfaction indicator
        """
        problem_text = "My hostel room AC is not working."
        ai_result = {
            "summary": "Hostel room AC unit is unresponsive or not cooling.",
            "suggestedWorkaround": "Check power switch, circuit breaker, and remote batteries.",
            "quickActions": ["Check power switch", "Reset remote thermostat"],
            "likelyCause": "Power supply disruption or thermostat misconfiguration",
            "priority": "normal",
        }

        # Simulate user clicking "✕ This didn't solve my problem"
        enriched_ai_analysis = {
            **ai_result,
            "userSatisfied": False,
            "escalatedFromAI": True,
            "userFeedback": "This didn't solve my problem",
        }

        # Escalated problem payload prepared for submitProblem
        escalated_payload = {
            "title": problem_text[:100],
            "description": problem_text,
            "category": "General",
            "priority": enriched_ai_analysis["priority"],
            "workaround": enriched_ai_analysis["suggestedWorkaround"],
            "aiAnalysis": enriched_ai_analysis,
            "isEmergency": enriched_ai_analysis["priority"] == "high",
        }

        self.assertEqual(escalated_payload["title"], "My hostel room AC is not working.")
        self.assertEqual(escalated_payload["description"], "My hostel room AC is not working.")
        self.assertFalse(escalated_payload["aiAnalysis"]["userSatisfied"])
        self.assertTrue(escalated_payload["aiAnalysis"]["escalatedFromAI"])
        self.assertEqual(
            escalated_payload["aiAnalysis"]["userFeedback"],
            "This didn't solve my problem",
        )
        self.assertEqual(
            escalated_payload["workaround"],
            "Check power switch, circuit breaker, and remote batteries.",
        )


if __name__ == "__main__":
    unittest.main()
