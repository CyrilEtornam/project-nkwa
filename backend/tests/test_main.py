import unittest

from fastapi.testclient import TestClient

from main import app


class MainTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_health_check(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_core_routes_are_wired(self) -> None:
        checks = [
            ("post", "/api/v1/auth/register", 201),
            ("post", "/api/v1/auth/login", 200),
            ("get", "/api/v1/users/me", 200),
            ("get", "/api/v1/contacts", 200),
            ("post", "/api/v1/calls/initiate", 200),
            ("post", "/api/v1/sos", 200),
            ("get", "/api/v1/first-aid", 200),
        ]

        for method, path, status_code in checks:
            response = getattr(self.client, method)(path)
            self.assertEqual(response.status_code, status_code)


if __name__ == "__main__":
    unittest.main()
