from __future__ import annotations
import asyncio
import os
import boto3

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
LOCATION_INDEX = os.getenv("LOCATION_INDEX_NAME", "nkwa-place-index")
USE_MOCK = os.getenv("USE_MOCK", "true").strip().lower() in {"1", "true", "yes", "on"}

_location = boto3.client("location", region_name=AWS_REGION)


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
            _location.search_place_index_for_position,
            IndexName=LOCATION_INDEX,
            Position=[lon, lat],
            MaxResults=1,
        )
        results = response.get("Results", [])
        if not results:
            return _fallback(lat, lon)
        place = results[0].get("Place", {})
        label = place.get("Label", "Unknown location")
        municipality = place.get("Municipality", "")
        region = place.get("Region", "")
        return {
            "landmark_name": label,
            "district": municipality,
            "region": region,
            "directions_narrative": f"Caller is near {label}, {municipality}, {region}.",
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
