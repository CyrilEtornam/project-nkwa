from __future__ import annotations
import os
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
USE_MOCK = os.getenv("USE_MOCK", "true").strip().lower() in {"1", "true", "yes", "on"}

# In-memory store used when USE_MOCK=true
_MOCK_DB: dict[str, list[dict]] = {}

# Real DynamoDB resource — only used when USE_MOCK=false
_dynamodb = None


def _get_dynamodb():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb


def _table(name: str):
    return _get_dynamodb().Table(name)


def _mock_find(table_name: str, key: dict) -> dict | None:
    for item in _MOCK_DB.get(table_name, []):
        if all(item.get(k) == v for k, v in key.items()):
            return item
    return None


def get_item(table_name: str, key: dict) -> dict | None:
    if USE_MOCK:
        return _mock_find(table_name, key)
    response = _table(table_name).get_item(Key=key)
    return response.get("Item")


def put_item(table_name: str, item: dict) -> None:
    if USE_MOCK:
        rows = _MOCK_DB.setdefault(table_name, [])
        # Determine key fields from the item (anything that uniquely identifies it)
        # We infer: replace existing item if all key values match, else append.
        # The callers always pass a full item, so we just upsert by matching known pk fields.
        for i, row in enumerate(rows):
            if row.get("call_id") and row["call_id"] == item.get("call_id"):
                rows[i] = item
                return
            if row.get("user_id") and not row.get("contact_id") and row["user_id"] == item.get("user_id") and not item.get("contact_id"):
                rows[i] = item
                return
            if row.get("user_id") and row.get("contact_id") and row["user_id"] == item.get("user_id") and row["contact_id"] == item.get("contact_id"):
                rows[i] = item
                return
            if row.get("guide_id") and row["guide_id"] == item.get("guide_id"):
                rows[i] = item
                return
        rows.append(item)
        return
    _table(table_name).put_item(Item=item)


def update_item(table_name: str, key: dict, updates: dict) -> None:
    if USE_MOCK:
        item = _mock_find(table_name, key)
        if item is not None:
            item.update(updates)
        return
    keys = list(updates.keys())
    expr = "SET " + ", ".join(f"#k{i} = :v{i}" for i in range(len(keys)))
    names = {f"#k{i}": k for i, k in enumerate(keys)}
    values = {f":v{i}": v for i, v in enumerate(updates.values())}
    _table(table_name).update_item(
        Key=key,
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )


def delete_item(table_name: str, key: dict) -> None:
    if USE_MOCK:
        rows = _MOCK_DB.get(table_name, [])
        _MOCK_DB[table_name] = [r for r in rows if not all(r.get(k) == v for k, v in key.items())]
        return
    _table(table_name).delete_item(Key=key)


def query_by_partition(table_name: str, partition_key: str, partition_value: str) -> list[dict]:
    if USE_MOCK:
        return [r for r in _MOCK_DB.get(table_name, []) if r.get(partition_key) == partition_value]
    response = _table(table_name).query(
        KeyConditionExpression=Key(partition_key).eq(partition_value)
    )
    return response.get("Items", [])


def scan_table(table_name: str, filter_expression=None) -> list[dict]:
    if USE_MOCK:
        return list(_MOCK_DB.get(table_name, []))
    kwargs: dict[str, Any] = {}
    if filter_expression is not None:
        kwargs["FilterExpression"] = filter_expression
    response = _table(table_name).scan(**kwargs)
    return response.get("Items", [])
