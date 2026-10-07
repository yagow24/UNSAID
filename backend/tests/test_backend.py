"""
UNSAID Backend Test Suite
Tests health, auth rejection, workspace validation, and AI error handling.
"""

import unittest
from unittest.mock import patch
from backend.app import app

class BackendTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health_endpoint(self):
        """Test GET /api/health returns 200 and healthy status."""
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data.get("status"), "healthy")
        self.assertIn("aiConfigured", data)

    def test_ai_status_endpoint(self):
        """Test GET /api/ai/status returns 200."""
        res = self.client.get("/api/ai/status")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertTrue(data.get("model", "").startswith("gemini-"))

    def test_unauthenticated_request_rejected(self):
        """Test that POST /api/ai/analyze-problem without token returns 401."""
        res = self.client.post(
            "/api/ai/analyze-problem",
            json={
                "title": "Broken elevator in Block C",
                "description": "Elevator stuck on floor 3",
                "workspaceId": "ws_123",
            },
        )
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertEqual(data.get("error", {}).get("code"), "AUTH_REQUIRED")

    def test_invalid_token_rejected(self):
        """Test that invalid Bearer token returns 401."""
        res = self.client.post(
            "/api/ai/analyze-problem",
            headers={"Authorization": "Bearer invalid.jwt.token"},
            json={
                "title": "Broken elevator in Block C",
                "description": "Elevator stuck on floor 3",
                "workspaceId": "ws_123",
            },
        )
        self.assertEqual(res.status_code, 401)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertEqual(data.get("error", {}).get("code"), "AUTH_INVALID")

    @patch("backend.middleware.auth_middleware.verify_token")
    def test_missing_workspace_rejected(self, mock_verify):
        """Test that authenticated request without workspaceId returns 400."""
        mock_verify.return_value = {"uid": "user_123", "email": "test@unsaid.org"}
        res = self.client.post(
            "/api/ai/analyze-problem",
            headers={"Authorization": "Bearer mock_valid_token"},
            json={
                "title": "Broken elevator",
                "description": "Elevator is stuck",
            },
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertEqual(data.get("error", {}).get("code"), "WORKSPACE_REQUIRED")

    @patch("backend.middleware.auth_middleware.verify_token")
    def test_empty_title_rejected(self, mock_verify):
        """Test that empty problem title returns 400 validation error."""
        mock_verify.return_value = {"uid": "user_123", "email": "test@unsaid.org"}
        res = self.client.post(
            "/api/ai/analyze-problem",
            headers={"Authorization": "Bearer mock_valid_token"},
            json={
                "title": "",
                "description": "Details without title",
                "workspaceId": "ws_test",
            },
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertEqual(data.get("error", {}).get("code"), "VALIDATION_FAILED")

    @patch("backend.middleware.auth_middleware.verify_token")
    @patch("backend.services.gemini_service.is_gemini_configured")
    def test_gemini_not_configured_graceful_error(self, mock_cfg, mock_verify):
        """Test that unconfigured Gemini key returns 503 with user-friendly message."""
        mock_verify.return_value = {"uid": "user_123", "email": "test@unsaid.org"}
        mock_cfg.return_value = False

        res = self.client.post(
            "/api/ai/analyze-problem",
            headers={"Authorization": "Bearer mock_valid_token"},
            json={
                "title": "Water leakage in Room 204",
                "description": "Ceiling is leaking onto desk",
                "workspaceId": "ws_test",
            },
        )
        self.assertEqual(res.status_code, 503)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertIn("temporarily unavailable", data.get("error", {}).get("message"))

    @patch("backend.middleware.auth_middleware.verify_token")
    @patch("backend.routes.ai_routes.analyze_problem")
    def test_successful_structured_problem_analysis(self, mock_analyze, mock_verify):
        """Test successful problem analysis returns structured JSON."""
        mock_verify.return_value = {"uid": "user_123", "email": "test@unsaid.org"}
        mock_analyze.return_value = {
            "summary": "Water is leaking from Room 204 ceiling",
            "category": "Facilities",
            "priority": "high",
            "urgency": "urgent",
            "suggestedWorkaround": "Place a bucket beneath leak and move electrical appliances.",
            "likelyCause": "Pipe rupture in floor above",
            "quickActions": [
                "Move laptops and power strips away from water",
                "Contact maintenance emergency team",
            ],
            "needsHumanAttention": True,
            "confidence": 0.94,
            "hasSimilarProblem": False,
            "similarProblems": [],
            "model": "gemini-2.5-flash",
        }

        res = self.client.post(
            "/api/ai/analyze-problem",
            headers={"Authorization": "Bearer mock_valid_token"},
            json={
                "title": "Ceiling leaking onto desks",
                "description": "Active dripping from air vent in room 204",
                "workspaceId": "ws_test",
                "category": "Facilities",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        analysis = data.get("analysis", {})
        self.assertEqual(analysis.get("priority"), "high")
        self.assertEqual(analysis.get("urgency"), "urgent")
        self.assertTrue(analysis.get("needsHumanAttention"))
        self.assertIsInstance(analysis.get("quickActions"), list)
        self.assertGreater(len(analysis.get("quickActions")), 0)

    @patch("backend.middleware.auth_middleware.verify_token")
    @patch("backend.routes.ai_routes.generate_admin_summary")
    def test_admin_summary_endpoint(self, mock_summary, mock_verify):
        """Test POST /api/ai/admin-summary returns structured executive insights."""
        mock_verify.return_value = {"uid": "admin_123", "email": "admin@unsaid.org"}
        mock_summary.return_value = {
            "overview": "3 open issues reported across campus facilities.",
            "topIssues": ["HVAC in Library", "Wi-Fi in Block B"],
            "priorityInsights": ["1 emergency issue active"],
            "recurringPatterns": ["Network degradation during peak hours"],
            "recommendedActions": ["Dispatch technician to Block B router"],
            "model": "gemini-2.5-flash",
        }

        res = self.client.post(
            "/api/ai/admin-summary",
            headers={"Authorization": "Bearer mock_valid_token"},
            json={
                "workspaceId": "ws_test",
                "workspaceName": "Engineering Block",
                "problems": [
                    {"id": "p1", "title": "Wi-Fi down", "category": "Network", "priority": "high", "status": "open"}
                ],
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        summary = data.get("summary", {})
        self.assertIn("overview", summary)
        self.assertIn("topIssues", summary)
        self.assertIn("recommendedActions", summary)

    @patch("backend.middleware.auth_middleware.verify_token")
    @patch("backend.routes.ai_routes.test_gemini_connection")
    def test_connection_diagnostic_endpoint(self, mock_test_conn, mock_verify):
        """Test POST /api/ai/test-connection returns diagnostic status."""
        mock_verify.return_value = {"uid": "admin_123", "email": "admin@unsaid.org"}
        mock_test_conn.return_value = {
            "success": True,
            "model": "gemini-2.5-flash",
            "response": {"greeting": "Hello", "status": "online"},
        }

        res = self.client.post(
            "/api/ai/test-connection",
            headers={"Authorization": "Bearer mock_valid_token"},
        )
        self.assertEqual(res.status_code, 200)
    @patch("backend.middleware.auth_middleware.verify_token")
    @patch("backend.routes.ai_routes.generate_user_chat_response")
    def test_user_chat_endpoint_success(self, mock_chat, mock_verify):
        """Test POST /api/ai/chat returns successful Gemini response."""
        mock_verify.return_value = {"uid": "user_456", "email": "user@unsaid.org"}
        mock_chat.return_value = {
            "reply": "I can help you report issues or check query status.",
            "model": "gemini-2.5-flash-lite",
        }

        res = self.client.post(
            "/api/ai/chat",
            headers={"Authorization": "Bearer mock_valid_token"},
            json={
                "message": "Hello, what can you help me with?",
                "workspaceId": "ws_test",
                "workspaceName": "Workspace Test",
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data.get("success"))
        self.assertEqual(data.get("reply"), "I can help you report issues or check query status.")
        self.assertEqual(data.get("model"), "gemini-2.5-flash-lite")

    @patch("backend.middleware.auth_middleware.verify_token")
    def test_user_chat_missing_message_rejected(self, mock_verify):
        """Test POST /api/ai/chat returns 400 when message is empty."""
        mock_verify.return_value = {"uid": "user_456", "email": "user@unsaid.org"}
        res = self.client.post(
            "/api/ai/chat",
            headers={"Authorization": "Bearer mock_valid_token"},
            json={
                "message": "   ",
                "workspaceId": "ws_test",
            },
        )
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data.get("success"))
        self.assertEqual(data.get("error", {}).get("code"), "VALIDATION_FAILED")

if __name__ == "__main__":
    unittest.main()

