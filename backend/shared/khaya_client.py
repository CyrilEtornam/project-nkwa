from __future__ import annotations

import asyncio
import hashlib
import json
import os
from base64 import b64decode
from pathlib import Path
from typing import Any
from uuid import uuid4

import boto3
import httpx


KHAYA_BASE_URL = "https://translation-api.ghananlp.org"
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "nkwa-audio")
KHAYA_API_KEY = os.getenv("KHAYA_API_KEY", "")
USE_MOCK = os.getenv("USE_MOCK", "true").strip().lower() in {"1", "true", "yes", "on"}

# Maps first-4-byte magic signatures to (content_type, transcribe_media_format, file_extension)
_FORMAT_TABLE: dict[bytes, tuple[str, str, str]] = {
    b"RIFF": ("audio/wav",  "wav",  "wav"),
    b"fLaC": ("audio/flac", "flac", "flac"),
    b"OggS": ("audio/ogg",  "ogg",  "ogg"),
}


def detect_audio_format(audio_bytes: bytes) -> tuple[str, str, str]:
    sig = audio_bytes[:4]
    if sig in _FORMAT_TABLE:
        return _FORMAT_TABLE[sig]
    # MP3: ID3 tag header OR raw MPEG sync word (0xFF 0xFB / 0xF3 / 0xF2)
    if sig[:3] == b"ID3" or sig[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "audio/mpeg", "mp3", "mp3"
    return "audio/wav", "wav", "wav"  # safe fallback


_CACHE: dict[str, Any] = {}
_FIXTURE_DIRS = (
    Path(__file__).resolve().parents[1] / "tests" / "fixtures",
    Path(__file__).resolve().parents[2] / "tests" / "fixtures",
)


def _cache_key(prefix: str, *parts: Any) -> str:
    payload = "|".join(str(part) for part in parts)
    return hashlib.sha256(f"{prefix}:{payload}".encode("utf-8")).hexdigest()


def _get_cache(key: str) -> Any:
    return _CACHE.get(key)


def _set_cache(key: str, value: Any) -> None:
    _CACHE[key] = value


def _fixture_path(name: str) -> Path | None:
    for fixture_dir in _FIXTURE_DIRS:
        path = fixture_dir / name
        if path.exists():
            return path
    return None


def _load_mock_json(name: str, fallback: dict[str, Any]) -> dict[str, Any]:
    path = _fixture_path(name)
    if path is None:
        return fallback

    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def _load_mock_bytes(name: str, fallback: bytes) -> bytes:
    path = _fixture_path(name)
    if path is None:
        return fallback

    raw = path.read_bytes()
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return raw

    for key in ("audio_base64", "mp3_base64", "bytes_base64", "base64"):
        value = payload.get(key)
        if isinstance(value, str):
            try:
                return b64decode(value)
            except (ValueError, TypeError):
                break

    return raw


def _mock_transcript(language: str) -> str:
    if language == "en":
        data = _load_mock_json("english_asr_response.json", {"text": "Mock English transcription"})
        return str(data.get("text") or data.get("transcript") or "Mock English transcription")

    if language == "tw":
        data = _load_mock_json("asr_response_twi.json", {"text": "Mock Twi transcription"})
        return str(data.get("text") or data.get("transcript") or "Mock Twi transcription")

    data = _load_mock_json(f"asr_response_{language}.json", {"text": f"Mock transcription for {language}"})
    return str(data.get("text") or data.get("transcript") or f"Mock transcription for {language}")


def _mock_translation(text: str) -> str:
    data = _load_mock_json("translate_response.json", {"text": "Mock English translation"})
    translated = data.get("text") or data.get("translation") or data.get("translated_text")
    if isinstance(translated, str) and translated.strip():
        return translated
    return f"Mock English translation: {text}"


def _mock_tts(language: str) -> bytes:
    if language == "en":
        return _load_mock_bytes("english_tts_response.json", b"Mock English MP3 audio")
    return _load_mock_bytes("tts_speakers.json", f"Mock MP3 audio for {language}".encode("utf-8"))


async def transcribe(audio_bytes: bytes, language: str | None = None, lang: str | None = None) -> str:
    resolved_language = language or lang or "en"
    cache_key = _cache_key("transcribe", resolved_language, hashlib.sha256(audio_bytes).hexdigest())

    cached = _get_cache(cache_key)
    if cached is not None:
        return str(cached)

    if USE_MOCK:
        transcription = _mock_transcript(resolved_language)
        _set_cache(cache_key, transcription)
        return transcription

    content_type, media_format, _ = detect_audio_format(audio_bytes)

    if resolved_language == "en":
        transcription = await _transcribe_english(audio_bytes, content_type, media_format)
    else:
        transcription = await _transcribe_khaya(audio_bytes, resolved_language, content_type)

    _set_cache(cache_key, transcription)
    return transcription


async def translate(text: str, source_lang: str | None = None, lang_pair: str | None = None) -> str:
    resolved_source_lang = source_lang
    if resolved_source_lang is None and lang_pair:
        resolved_source_lang = lang_pair.split("-", 1)[0]
    resolved_source_lang = resolved_source_lang or "en"

    if resolved_source_lang == "en":
        return text

    cache_key = _cache_key("translate", resolved_source_lang, text)
    cached = _get_cache(cache_key)
    if cached is not None:
        return str(cached)

    if USE_MOCK:
        translated_text = _mock_translation(text)
        _set_cache(cache_key, translated_text)
        return translated_text

    translated_text = await _translate_khaya(text, resolved_source_lang, lang_pair)
    _set_cache(cache_key, translated_text)
    return translated_text


async def synthesize(text: str, language: str | None = None, lang: str | None = None) -> bytes:
    resolved_language = language or lang or "en"

    if USE_MOCK:
        return _mock_tts(resolved_language)

    if resolved_language == "en":
        return await _synthesize_english(text)

    return await _synthesize_khaya(text, resolved_language)


async def _transcribe_english(audio_bytes: bytes, content_type: str, media_format: str) -> str:
    job_name = f"nkwa-{uuid4()}"
    temp_key = f"tmp/transcribe/{job_name}.{media_format}"
    s3_client = boto3.client("s3", region_name=AWS_REGION)
    transcribe_client = boto3.client("transcribe", region_name=AWS_REGION)

    await asyncio.to_thread(
        s3_client.put_object,
        Bucket=S3_BUCKET_NAME,
        Key=temp_key,
        Body=audio_bytes,
        ContentType=content_type,
    )

    try:
        await asyncio.to_thread(
            transcribe_client.start_transcription_job,
            TranscriptionJobName=job_name,
            LanguageCode="en-US",
            MediaFormat=media_format,
            Media={"MediaFileUri": f"s3://{S3_BUCKET_NAME}/{temp_key}"},
            OutputBucketName=S3_BUCKET_NAME,
        )

        while True:
            job_response = await asyncio.to_thread(
                transcribe_client.get_transcription_job,
                TranscriptionJobName=job_name,
            )
            job = job_response["TranscriptionJob"]
            status = job["TranscriptionJobStatus"]

            if status == "COMPLETED":
                transcript_uri = job["Transcript"]["TranscriptFileUri"]
                async with httpx.AsyncClient(timeout=60.0) as client:
                    transcript_response = await client.get(transcript_uri)
                    transcript_response.raise_for_status()
                    payload = transcript_response.json()

                transcript_items = payload.get("results", {}).get("transcripts", [])
                if transcript_items:
                    transcript = str(transcript_items[0].get("transcript", ""))
                    if transcript:
                        return transcript
                raise RuntimeError("Amazon Transcribe completed without a transcript payload")

            if status == "FAILED":
                failure_reason = job.get("FailureReason", "Unknown transcription failure")
                raise RuntimeError(f"Amazon Transcribe failed: {failure_reason}")

            await asyncio.sleep(2)
    finally:
        await asyncio.to_thread(s3_client.delete_object, Bucket=S3_BUCKET_NAME, Key=temp_key)


async def _transcribe_khaya(audio_bytes: bytes, language: str, content_type: str) -> str:
    headers = {
        "Ocp-Apim-Subscription-Key": KHAYA_API_KEY,
        "Content-Type": content_type,
    }
    params = {"language": language}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(f"{KHAYA_BASE_URL}/asr/v3/transcribe", params=params, content=audio_bytes, headers=headers)
        response.raise_for_status()
        payload = response.json()

    if isinstance(payload, dict):
        for key in ("text", "transcript", "transcription"):
            value = payload.get(key)
            if isinstance(value, str):
                return value

    raise RuntimeError("Khaya ASR response did not contain transcription text")


async def _translate_khaya(text: str, source_lang: str, lang_pair: str | None) -> str:
    headers = {"Ocp-Apim-Subscription-Key": KHAYA_API_KEY}
    payload = {"in": text, "lang": lang_pair or f"{source_lang}-en"}

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(f"{KHAYA_BASE_URL}/v2/translate", json=payload, headers=headers)
        response.raise_for_status()

        try:
            data = response.json()
        except ValueError:
            return response.text

    if isinstance(data, str):
        return data

    if isinstance(data, dict):
        for key in ("text", "translation", "translated_text", "result"):
            value = data.get(key)
            if isinstance(value, str):
                return value

    return response.text


async def _synthesize_english(text: str) -> bytes:
    polly_client = boto3.client("polly", region_name=AWS_REGION)
    response = await asyncio.to_thread(
        polly_client.synthesize_speech,
        OutputFormat="mp3",
        VoiceId="Joanna",
        LanguageCode="en-US",
        Text=text,
    )
    audio_stream = response["AudioStream"]
    return await asyncio.to_thread(audio_stream.read)


async def _synthesize_khaya(text: str, language: str) -> bytes:
    headers = {
        "Ocp-Apim-Subscription-Key": KHAYA_API_KEY,
        "Accept": "audio/mp3",
    }
    payload = {
        "text": text,
        "language": language,
        "speaker_id": "female",
        "format": "mp3",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(f"{KHAYA_BASE_URL}/tts/v2/synthesize", json=payload, headers=headers)
        response.raise_for_status()
        return response.content


__all__ = ["transcribe", "translate", "synthesize", "detect_audio_format", "USE_MOCK"]