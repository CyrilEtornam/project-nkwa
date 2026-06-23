from __future__ import annotations
import asyncio
import os
import boto3

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
USE_MOCK = os.getenv("USE_MOCK", "true").strip().lower() in {"1", "true", "yes", "on"}

# geo-places is the V2 standalone client — no Place Index resource needed
_geo_places = boto3.client("geo-places", region_name=AWS_REGION)


async def resolve_location(lat: float, lon: float) -> dict:
    if USE_MOCK:
        return {
            "landmark_name": "Accra Mall",
            "district": "Spintex",
            "region": "Greater Accra",
            "directions_narrative": "Caller is approximately 150 metres east of Accra Mall, near the Total filling station on Spintex Road.",
            "map_pin": {"lat": lat, "lon": lon, "label": "Caller location"},
        }
    try:
        response = await asyncio.to_thread(
            _geo_places.reverse_geocode,
            QueryPosition=[lon, lat],  # geo-places expects [longitude, latitude]
            MaxResults=1,
            Language="en",
        )
        items = response.get("ResultItems", [])
        if not items:
            return _fallback(lat, lon)
        item = items[0]
        address = item.get("Address", {})
        label = address.get("Label") or item.get("Title", "Unknown location")
        locality = address.get("Locality", "")
        region = address.get("Region", {}).get("Name", "")
        return {
            "landmark_name": label,
            "district": locality,
            "region": region,
            "directions_narrative": f"Caller is near {label}.",
            "map_pin": {"lat": lat, "lon": lon, "label": "Caller location"},
        }
    except Exception:
        return _fallback(lat, lon)


def _fallback(lat: float, lon: float) -> dict:
    return {
        "landmark_name": "Unknown",
        "district": "",
        "region": "",
        "directions_narrative": "Location could not be resolved.",
        "map_pin": {"lat": lat, "lon": lon, "label": "Caller location"},
    }
