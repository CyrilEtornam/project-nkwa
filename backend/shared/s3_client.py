from __future__ import annotations
import asyncio
import os
import boto3

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
S3_BUCKET = os.getenv("S3_BUCKET_NAME", "nkwa-audio")
USE_MOCK = os.getenv("USE_MOCK", "true").strip().lower() in {"1", "true", "yes", "on"}

_s3 = None


def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=AWS_REGION)
    return _s3


def _mock_url(key: str) -> str:
    return f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"


async def upload_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    if USE_MOCK:
        return _mock_url(key)
    await asyncio.to_thread(
        _get_s3().put_object,
        Bucket=S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return _mock_url(key)


async def upload_public(key: str, data: bytes, content_type: str) -> str:
    if USE_MOCK:
        return _mock_url(key)
    await asyncio.to_thread(
        _get_s3().put_object,
        Bucket=S3_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
        ACL="public-read",
    )
    return _mock_url(key)
