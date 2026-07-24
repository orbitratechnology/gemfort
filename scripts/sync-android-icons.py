"""Sync generated Expo icon assets into the Android native res folders."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets/images"
RES = ROOT / "android/app/src/main/res"

# Standard Android density multipliers
DENSITIES = {
    "mdpi": 1,
    "hdpi": 1.5,
    "xhdpi": 2,
    "xxhdpi": 3,
    "xxxhdpi": 4,
}


def resize(im: Image.Image, size: int) -> Image.Image:
    return im.resize((size, size), Image.Resampling.LANCZOS)


def save_webp(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGBA").save(path, "WEBP", quality=90, method=6)


def save_png(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGBA").save(path, "PNG", optimize=True)


def main() -> None:
    icon = Image.open(ASSETS / "icon.png").convert("RGBA")
    foreground = Image.open(ASSETS / "android-icon-foreground.png").convert("RGBA")
    background = Image.open(ASSETS / "android-icon-background.png").convert("RGBA")
    monochrome = Image.open(ASSETS / "android-icon-monochrome.png").convert("RGBA")
    splash = Image.open(ASSETS / "splash-icon.png").convert("RGBA")
    notification = Image.open(ASSETS / "notification-icon.png").convert("RGBA")

    for name, scale in DENSITIES.items():
        launcher_size = int(48 * scale)
        adaptive_size = int(108 * scale)
        splash_size = int(288 * scale)  # matches existing Expo prebuild sizes
        notif_size = int(24 * scale)

        mipmap = RES / f"mipmap-{name}"
        save_webp(resize(icon, launcher_size), mipmap / "ic_launcher.webp")
        save_webp(resize(icon, launcher_size), mipmap / "ic_launcher_round.webp")
        save_webp(resize(foreground, adaptive_size), mipmap / "ic_launcher_foreground.webp")
        save_webp(resize(background, adaptive_size), mipmap / "ic_launcher_background.webp")
        save_webp(resize(monochrome, adaptive_size), mipmap / "ic_launcher_monochrome.webp")

        save_png(resize(splash, splash_size), RES / f"drawable-{name}" / "splashscreen_logo.png")
        save_png(
            resize(splash, splash_size),
            RES / f"drawable-night-{name}" / "splashscreen_logo.png",
        )
        save_png(resize(notification, notif_size), RES / f"drawable-{name}" / "notification_icon.png")

        print(f"updated {name}: launcher={launcher_size} adaptive={adaptive_size} splash={splash_size}")

    print("done")


if __name__ == "__main__":
    main()
