import os
import unittest

os.environ["USE_MOCK"] = "true"
os.environ["AWS_EC2_METADATA_DISABLED"] = "true"

from shared import khaya_client


class KhayaClientTests(unittest.TestCase):
    def test_language_codes_normalize_to_iso3(self) -> None:
        self.assertEqual(khaya_client.normalize_language_code("tw"), "twi")
        self.assertEqual(khaya_client.normalize_language_code("ee"), "ewe")
        self.assertEqual(khaya_client.normalize_language_code("gaa"), "gaa")
        self.assertEqual(khaya_client.normalize_language_code("en"), "eng")

    def test_language_pair_uses_iso3_codes(self) -> None:
        self.assertEqual(khaya_client.build_lang_pair("en", "tw"), "eng-twi")
        self.assertEqual(khaya_client.build_lang_pair("tw", "en"), "twi-eng")
        self.assertEqual(khaya_client.build_lang_pair("eng", "gaa"), "eng-gaa")


if __name__ == "__main__":
    unittest.main()
