import os
import sys
import uuid
import unittest
from pathlib import Path

import requests

# Ensure we can import backend modules when running from repo root.
BACKEND_DIR = Path(__file__).resolve().parents[1]
BACKEND_PATH = str(BACKEND_DIR)
if BACKEND_PATH not in sys.path:
    sys.path.insert(0, BACKEND_PATH)

from db.snapshot import get_snapshot_manager  # pylint: disable=wrong-import-position


class ReviewIntegrationTest(unittest.TestCase):
    """End-to-end regression for the review/rollback endpoints."""

    @classmethod
    def setUpClass(cls):
        cls.base_url = os.environ.get("REVIEW_BASE_URL", "http://localhost:8000")
        cls.session_id = f"test_session_{uuid.uuid4().hex[:8]}"
        cls.entity_id = f"char_review_{uuid.uuid4().hex[:8]}"
        cls.manager = get_snapshot_manager()
        cls.manager.clear_session(cls.session_id)

        try:
            resp = requests.get(f"{cls.base_url}/health", timeout=10)
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise unittest.SkipTest(f"Backend not reachable: {exc}") from exc

    @classmethod
    def tearDownClass(cls):
        try:
            requests.delete(f"{cls.base_url}/nodes/entities/{cls.entity_id}", timeout=10)
        except requests.RequestException:
            pass
        cls.manager.clear_session(cls.session_id)

    def test_review_roundtrip(self):
        base = self.base_url
        initial_content = "Initial review integration content."
        create_payload = {
            "entity_id": self.entity_id,
            "node_type": "character",
            "name": "Integration Entity",
            "content": initial_content,
            "task_description": "create-for-review-test",
        }

        create_resp = requests.post(f"{base}/nodes/entities", json=create_payload, timeout=10)
        self.assertEqual(create_resp.status_code, 200, create_resp.text)

        info_resp = requests.get(
            f"{base}/nodes/entities/{self.entity_id}",
            params={
                "include_basic": True,
                "include_history": False,
                "include_edges": False,
            },
            timeout=10,
        )
        self.assertEqual(info_resp.status_code, 200, info_resp.text)
        entity_info = info_resp.json()
        current_data = entity_info.get("basic") or {}
        self.assertTrue(current_data, "Entity basic info missing")

        snapshot_created = self.manager.create_snapshot(
            session_id=self.session_id,
            resource_id=self.entity_id,
            resource_type="entity",
            snapshot_data={
                "operation_type": "modify",
                "entity_id": self.entity_id,
                "version": current_data["version"],
                "name": current_data.get("name") or create_payload["name"],
                "content": current_data["content"],
                "inheritable": None,
            },
        )
        self.assertTrue(snapshot_created, "Snapshot was not created")

        update_payload = {
            "new_content": "Updated content for integration test rollback.",
            "task_description": "update-for-review-test",
        }
        update_resp = requests.post(
            f"{base}/nodes/entities/{self.entity_id}/update",
            json=update_payload,
            timeout=10,
        )
        self.assertEqual(update_resp.status_code, 200, update_resp.text)

        sessions_resp = requests.get(f"{base}/review/sessions", timeout=10)
        self.assertEqual(sessions_resp.status_code, 200, sessions_resp.text)
        sessions = sessions_resp.json()
        session_entry = next(
            (s for s in sessions if s["session_id"] == self.session_id), None
        )
        self.assertIsNotNone(session_entry, "Session entry missing")
        self.assertEqual(session_entry["resource_count"], 1)

        snapshots_resp = requests.get(
            f"{base}/review/sessions/{self.session_id}/snapshots", timeout=10
        )
        self.assertEqual(snapshots_resp.status_code, 200, snapshots_resp.text)
        snapshots = snapshots_resp.json()
        self.assertEqual(len(snapshots), 1)
        self.assertEqual(snapshots[0]["resource_id"], self.entity_id)

        diff_resp = requests.get(
            f"{base}/review/sessions/{self.session_id}/diff/{self.entity_id}",
            timeout=10,
        )
        self.assertEqual(diff_resp.status_code, 200, diff_resp.text)
        diff_data = diff_resp.json()
        self.assertTrue(diff_data["has_changes"])
        self.assertIn("diff_unified", diff_data)
        self.assertNotEqual(diff_data["diff_unified"].strip(), "")

        rollback_resp = requests.post(
            f"{base}/review/sessions/{self.session_id}/rollback/{self.entity_id}",
            json={"task_description": "rollback-for-review-test"},
            timeout=10,
        )
        self.assertEqual(rollback_resp.status_code, 200, rollback_resp.text)
        rollback_data = rollback_resp.json()
        self.assertTrue(rollback_data["success"])
        self.assertIsNotNone(rollback_data["new_version"])

        diff_after_resp = requests.get(
            f"{base}/review/sessions/{self.session_id}/diff/{self.entity_id}",
            timeout=10,
        )
        self.assertEqual(diff_after_resp.status_code, 200, diff_after_resp.text)
        diff_after = diff_after_resp.json()
        self.assertFalse(diff_after["has_changes"])

        delete_session_resp = requests.delete(
            f"{base}/review/sessions/{self.session_id}", timeout=10
        )
        self.assertEqual(delete_session_resp.status_code, 200, delete_session_resp.text)
        message = delete_session_resp.json()["message"]
        self.assertIn("cleared", message)


if __name__ == "__main__":
    unittest.main()
