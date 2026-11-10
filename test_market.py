import unittest
from main import normalize_market

class MarketTests(unittest.TestCase):
    def test_normalizes_signed_changes_and_index_units(self):
        data = {"resultCode": "success", "result": {"time": 123, "areas": [
            {"name": "SERVICE_INDEX", "datas": [{"cd": "KOSPI", "nv": 523063, "cv": 21178, "cr": 4.22, "rf": "2"}]},
            {"name": "SERVICE_ITEM", "datas": [{"cd": "005930", "nm": "삼성전자", "nv": 198800, "cv": 8900, "cr": 4.69, "rf": "5", "aq": 123, "ov": 190000, "hv": 201000, "lv": 188000, "sv": 189900}]},
        ]}}
        result = normalize_market(data)
        self.assertEqual(result["indices"][0]["price"], 5230.63)
        stock = result["stocks"][0]
        self.assertEqual((stock["change"], stock["rate"], stock["name"]), (-8900, -4.69, "삼성전자"))
        self.assertEqual((stock["open"], stock["high"], stock["low"], stock["previous"]), (190000, 201000, 188000, 189900))

    def test_rejects_missing_market_data(self):
        with self.assertRaises(ValueError):
            normalize_market({"resultCode": "success", "result": {"areas": []}})

if __name__ == "__main__":
    unittest.main()
