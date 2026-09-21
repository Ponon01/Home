import unittest

from app.data.canonical_complexes import CANONICAL_COMPLEXES
from scripts.ensure_housing_complexes import build_seed_rows


class EnsureHousingComplexesTests(unittest.TestCase):
    def test_build_seed_rows_contains_all_canonical_complexes(self) -> None:
        rows = build_seed_rows()

        self.assertEqual(len(rows), len(CANONICAL_COMPLEXES))
        self.assertTrue(all(row["image_path"] for row in rows))
        self.assertIn("Акку", [row["name"] for row in rows])
        self.assertIn("Respublika", [row["name"] for row in rows])


if __name__ == "__main__":
    unittest.main()
