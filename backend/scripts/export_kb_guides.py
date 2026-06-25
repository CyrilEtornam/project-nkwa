"""
Export first-aid guides as Markdown plus Bedrock Knowledge Base metadata files.

Usage from backend/:
    python scripts/export_kb_guides.py

The output folder can be uploaded to the S3 data source configured for the
Bedrock Knowledge Base.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "first_aid_guides.json"
OUTPUT_DIR = ROOT / "kb_export" / "first_aid_guides"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "guide"


def guide_to_markdown(guide: dict) -> str:
    lines = [
        f"# {guide.get('title', '')}",
        "",
        f"Guide ID: {guide.get('guide_id', '')}",
        f"Category: {guide.get('category', '')}",
        "",
        "## Overview",
        guide.get("overview", ""),
        "",
        "## First-Aid Steps",
    ]
    for step in guide.get("steps", []):
        lines.extend([
            "",
            f"### Step {step.get('step_number')}: {step.get('title', '')}",
            step.get("description", ""),
        ])
    lines.append("")
    return "\n".join(lines)


def metadata_for(guide: dict) -> dict:
    title = str(guide.get("title", ""))
    category = str(guide.get("category", ""))
    aliases = [
        title.lower(),
        category.lower(),
        str(guide.get("overview", "")).lower(),
    ]
    return {
        "metadataAttributes": {
            "guide_id": guide.get("guide_id", ""),
            "title": title,
            "category": category,
            "incident_aliases": " | ".join(alias for alias in aliases if alias),
            "source_type": "approved_first_aid_guide",
        }
    }


def main() -> None:
    guides = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for guide in guides:
        guide_id = guide.get("guide_id", "guide")
        slug = slugify(f"{guide_id}-{guide.get('title', '')}")
        markdown_path = OUTPUT_DIR / f"{slug}.md"
        metadata_path = OUTPUT_DIR / f"{slug}.md.metadata.json"

        markdown_path.write_text(guide_to_markdown(guide), encoding="utf-8")
        metadata_path.write_text(json.dumps(metadata_for(guide), indent=2), encoding="utf-8")
        print(f"exported {markdown_path.name}")

    print(f"\nExported {len(guides)} guides to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
