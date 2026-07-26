#!/usr/bin/env python3
"""Sync theme-aware shortcut PNGs into android/ mipmaps (non-adaptive)."""

from __future__ import annotations

import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "app" / "src" / "main" / "res"
ASSETS = ROOT / "assets" / "images" / "shortcuts"
BASELINE = 108
DENSITIES = {
    "mipmap-mdpi": 1,
    "mipmap-hdpi": 1.5,
    "mipmap-xhdpi": 2,
    "mipmap-xxhdpi": 3,
    "mipmap-xxxhdpi": 4,
}
KEYS = [
    "verify",
    "gem",
    "add",
    "ap",
    "cheque",
    "service",
    "jobs",
    "contacts",
    "bill",
    "certificates",
    "money",
    "directory",
    "search",
    "news",
]
THEMES = ["light", "dark"]


def main() -> None:
    removed = 0
    anydpi = RES / "mipmap-anydpi-v26"
    if anydpi.is_dir():
        for path in anydpi.glob("shortcut_*"):
            path.unlink()
            removed += 1
    for dens in DENSITIES:
        folder = RES / dens
        if not folder.is_dir():
            continue
        for path in folder.glob("shortcut_*"):
            path.unlink()
            removed += 1
    print(f"removed {removed} legacy shortcut files")

    written = 0
    for dens, scale in DENSITIES.items():
        folder = RES / dens
        folder.mkdir(parents=True, exist_ok=True)
        size = int(BASELINE * scale)
        for key in KEYS:
            for theme in THEMES:
                src = ASSETS / f"shortcut_{key}_{theme}.png"
                if not src.is_file():
                    raise SystemExit(f"missing {src}")
                img = Image.open(src).convert("RGBA").resize(
                    (size, size), Image.Resampling.LANCZOS
                )
                img.save(folder / f"shortcut_{key}_{theme}.png")
                written += 1
    print(f"wrote {written} theme mipmaps")

    colors = RES / "values" / "colors.xml"
    text = colors.read_text(encoding="utf-8")
    cleaned = re.sub(
        r"\n\s*<color name=\"shortcut_[^\"]+_background_color\">[^<]*</color>",
        "",
        text,
    )
    colors.write_text(cleaned, encoding="utf-8")
    print("cleaned colors.xml")


if __name__ == "__main__":
    main()
