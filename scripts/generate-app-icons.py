"""Generate GemFort app icon variants from assets/images/new-icon.png.

Android adaptive icons mask into circles / squircles / rounded squares.
Key artwork must stay inside the center ~66% safe zone
(https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).
We target ~52% so round launchers still show clear padding around the mark.
Opaque store / legacy icons use a padded mark on #000 so iOS/Android rounded
masks also keep breathing room.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets/images/new-icon.png"
OUT = ROOT / "assets/images"
ICON_DIR = ROOT / "assets/app-icon.icon/Assets"

# Fraction of the 1024 canvas the mark's longest side may occupy.
ANDROID_ADAPTIVE_SCALE = 0.52  # inside 66% safe zone, with margin for round masks
OPAQUE_ICON_SCALE = 0.68  # breathing room under iOS/Android rounded-square masks
# Android 12+ splash also applies a circular mask (~2/3 diameter safe zone).
SPLASH_MARK_SCALE = 0.50
UI_MARK_SCALE = 0.78


def remove_black_bg(im: Image.Image, threshold: int = 18) -> Image.Image:
    """Make near-black pixels transparent while keeping the fort + gem."""
    px = im.load()
    out = im.copy()
    out_px = out.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                out_px[x, y] = (0, 0, 0, 0)
    return out


def scale_center(im: Image.Image, scale: float) -> Image.Image:
    """Scale content to `scale` of canvas and center on transparent 1024."""
    target = 1024
    size = max(1, int(target * scale))
    bbox = im.getbbox()
    if not bbox:
        return Image.new("RGBA", (target, target), (0, 0, 0, 0))
    cropped = im.crop(bbox)
    cw, ch = cropped.size
    s = min(size / cw, size / ch)
    nw, nh = max(1, int(cw * s)), max(1, int(ch * s))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    canvas.paste(resized, ((target - nw) // 2, (target - nh) // 2), resized)
    return canvas


def on_black(im: Image.Image) -> Image.Image:
    """Composite transparent mark onto opaque black (store / legacy icons)."""
    bg = Image.new("RGBA", im.size, (0, 0, 0, 255))
    bg.alpha_composite(im)
    return bg


def to_monochrome_white(im: Image.Image) -> Image.Image:
    """White silhouette using luminance as alpha (Material You / notification)."""
    out = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sp = im.load()
    op = out.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = sp[x, y]
            if a < 8:
                continue
            lum = int(0.2126 * r + 0.7152 * g + 0.0722 * b)
            alpha = min(255, int(a * (0.35 + 0.65 * (lum / 255.0))))
            if alpha < 12:
                continue
            op[x, y] = (255, 255, 255, alpha)
    return out


def solid_bg(color=(0, 0, 0, 255), size=(1024, 1024)) -> Image.Image:
    return Image.new("RGBA", size, color)


def save_opaque_rgb(path: Path, im: Image.Image) -> None:
    rgb = Image.new("RGB", im.size, (0, 0, 0))
    rgba = im.convert("RGBA")
    rgb.paste(rgba, mask=rgba.split()[-1])
    rgb.save(path, "PNG", optimize=True)


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    if src.size != (1024, 1024):
        print(f"upscaling source {src.size} -> 1024x1024")
        src = src.resize((1024, 1024), Image.Resampling.LANCZOS)
    print("source:", src.size, src.mode)

    transparent = remove_black_bg(src, threshold=18)

    android_fg = scale_center(transparent, ANDROID_ADAPTIVE_SCALE)
    android_mono = scale_center(to_monochrome_white(transparent), ANDROID_ADAPTIVE_SCALE)
    opaque_mark = scale_center(transparent, OPAQUE_ICON_SCALE)
    icon_opaque = on_black(opaque_mark)
    splash = scale_center(transparent, SPLASH_MARK_SCALE)
    mark_ui = scale_center(transparent, UI_MARK_SCALE)
    ios_glass = scale_center(transparent, OPAQUE_ICON_SCALE)

    notif = to_monochrome_white(scale_center(transparent, 0.70)).resize(
        (96, 96), Image.Resampling.LANCZOS
    )
    favicon = icon_opaque.resize((48, 48), Image.Resampling.LANCZOS)
    tinted = ImageOps.grayscale(icon_opaque.convert("RGB")).convert("RGBA")
    android_bg = solid_bg((0, 0, 0, 255))

    ICON_DIR.mkdir(parents=True, exist_ok=True)

    opaque_targets = {
        OUT / "icon.png": icon_opaque,
        OUT / "gemfort-icon.png": icon_opaque,
        OUT / "ios-light.png": icon_opaque,
        OUT / "ios-dark.png": icon_opaque,
        OUT / "favicon.png": favicon,
    }
    rgba_targets = {
        OUT / "ios-tinted.png": tinted,
        OUT / "splash-icon.png": splash,
        OUT / "icon-transparent.png": mark_ui,
        OUT / "logo.png": mark_ui,
        OUT / "android-icon-foreground.png": android_fg,
        OUT / "android-icon-background.png": android_bg,
        OUT / "android-icon-monochrome.png": android_mono,
        OUT / "notification-icon.png": notif,
        ICON_DIR / "icon.png": ios_glass,
    }

    for path, im in opaque_targets.items():
        save_opaque_rgb(path, im)
        print(f"wrote {path.relative_to(ROOT)} {im.size}")

    for path, im in rgba_targets.items():
        im.convert("RGBA").save(path, "PNG", optimize=True)
        print(f"wrote {path.relative_to(ROOT)} {im.size}")

    # Report fill ratios for verification
    for label, im in (
        ("android-fg", android_fg),
        ("opaque", opaque_mark),
        ("splash", splash),
    ):
        bbox = im.getbbox()
        if bbox:
            bw = bbox[2] - bbox[0]
            print(f"  {label} content width = {bw / 1024:.1%} of canvas")

    print("done")


if __name__ == "__main__":
    main()
