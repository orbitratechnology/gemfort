"""Generate GemFort app icons / splash assets from brand masters."""

from __future__ import annotations

import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "images"
ICON_DIR = ROOT / "assets" / "app-icon.icon"
ICON_ASSETS = ICON_DIR / "Assets"

# Near-black charcoal-teal from brand masters (sampled corners of gemfort-icon)
BG = (0, 22, 24, 255)  # #001618
BG_RGB = BG[:3]
SPLASH_BG = "#001618"
NOTIFICATION_TEAL = "#14b8a6"


# Icon guideline (Apple/Android): keep mark inside ~80% safe square AND circular crop.
# Android adaptive FG is stricter: key content must stay in center ~66%.
SAFE_AREA_FRAC = 0.80
CIRCLE_RADIUS_FRAC = 0.48  # 96% of inscribed-circle radius (canvas/2)
ANDROID_SAFE_FRAC = 0.66

SCALE_IN_APP_MARK = 0.92
SCALE_MARKETING = 0.76
SCALE_FAVICON = 0.72
SCALE_NOTIFICATION = 0.70
SCALE_SPLASH = 0.64


def inspect(path: Path) -> None:
    im = Image.open(path)
    print(f"{path.name}: size={im.size} mode={im.mode}")
    rgba = im.convert("RGBA")
    w, h = rgba.size
    for label, xy in [
        ("TL", (0, 0)),
        ("TR", (w - 1, 0)),
        ("BL", (0, h - 1)),
        ("BR", (w - 1, h - 1)),
        ("C", (w // 2, h // 2)),
    ]:
        print(f"  {label}={rgba.getpixel(xy)}")
    alpha = rgba.split()[-1]
    hist = alpha.histogram()
    print(
        f"  alpha transparent~={sum(hist[:10])} mid={sum(hist[10:250])} opaque~={sum(hist[250:])}"
    )


def trim_transparent(
    im: Image.Image,
    padding: int = 0,
    alpha_threshold: int = 40,
) -> Image.Image:
    """Crop to solid content, ignoring near-invisible fringe that inflates bbox."""
    rgba = im.convert("RGBA")
    alpha = rgba.split()[-1]
    mask = alpha.point(lambda a: 255 if a >= alpha_threshold else 0)
    bbox = mask.getbbox()
    if not bbox:
        return rgba
    cropped = rgba.crop(bbox)
    if padding <= 0:
        return cropped
    out = Image.new(
        "RGBA",
        (cropped.width + padding * 2, cropped.height + padding * 2),
        (0, 0, 0, 0),
    )
    out.paste(cropped, (padding, padding), cropped)
    return out


def _display_size(mark_w: int, mark_h: int, longest: float) -> tuple[float, float]:
    if mark_h >= mark_w:
        return longest * mark_w / mark_h, longest
    return longest, longest * mark_h / mark_w


def max_scale_for_guidelines(
    mark: Image.Image,
    canvas: int = 1024,
    *,
    safe_area: float = SAFE_AREA_FRAC,
    circle_radius_frac: float = CIRCLE_RADIUS_FRAC,
    hard_cap: float | None = None,
) -> float:
    """Largest longest-side fraction that fits the 80% square + circular crop."""
    mark = trim_transparent(mark)
    mw, mh = mark.size
    r_max = canvas * circle_radius_frac
    safe_max = canvas * safe_area
    lo, hi = 0.05, min(safe_area, hard_cap or 1.0)
    best = lo
    for _ in range(40):
        mid = (lo + hi) / 2
        dw, dh = _display_size(mw, mh, canvas * mid)
        fits_square = dw <= safe_max + 0.5 and dh <= safe_max + 0.5
        fits_circle = (dw / 2) ** 2 + (dh / 2) ** 2 <= r_max**2 + 0.5
        if fits_square and fits_circle:
            best = mid
            lo = mid
        else:
            hi = mid
    return best


def fit_centered(mark: Image.Image, canvas: int, scale: float) -> Image.Image:
    """Place mark so its longest visible side is `scale` of the canvas, centered."""
    mark = trim_transparent(mark)
    target = max(1, int(canvas * scale))
    fitted = mark.copy()
    fitted.thumbnail((target, target), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    x = (canvas - fitted.width) // 2
    y = (canvas - fitted.height) // 2
    out.paste(fitted, (x, y), fitted)
    return out


def fit_icon_guidelines(
    mark: Image.Image,
    canvas: int = 1024,
    *,
    hard_cap: float | None = None,
) -> Image.Image:
    scale = max_scale_for_guidelines(mark, canvas, hard_cap=hard_cap)
    return fit_centered(mark, canvas, scale)


def content_span(im: Image.Image) -> tuple[float, float]:
    rgba = im.convert("RGBA")
    bbox = rgba.split()[-1].point(lambda a: 255 if a >= 40 else 0).getbbox()
    if not bbox:
        return 0.0, 0.0
    return (bbox[2] - bbox[0]) / rgba.width, (bbox[3] - bbox[1]) / rgba.height


def opaque_icon(mark: Image.Image, canvas: int = 1024, scale: float | None = None) -> Image.Image:
    """Apple/Expo store icon: full-bleed square, no transparency, no rounded corners."""
    layered = (
        fit_centered(mark, canvas, scale)
        if scale is not None
        else fit_icon_guidelines(mark, canvas)
    )
    bg = Image.new("RGBA", (canvas, canvas), BG)
    bg.alpha_composite(layered)
    return bg.convert("RGB")


def monochrome_mark(
    mark: Image.Image,
    canvas: int = 1024,
    scale: float | None = None,
) -> Image.Image:
    """Android 13+ themed icon: white silhouette on transparent."""
    rgba = (
        fit_centered(mark, canvas, scale)
        if scale is not None
        else fit_icon_guidelines(mark, canvas, hard_cap=ANDROID_SAFE_FRAC)
    )
    alpha = rgba.split()[-1]
    alpha = alpha.filter(ImageFilter.MinFilter(3))
    white = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    white.putalpha(alpha)
    return white


def solid(color: tuple[int, int, int], size: int = 1024) -> Image.Image:
    return Image.new("RGB", (size, size), color)


def ensure_true_transparent(path: Path) -> Image.Image:
    """If master has baked black bg, punch near-black to alpha; else keep alpha."""
    rgba = Image.open(path).convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    # Sample corners — if already transparent, keep as-is
    corners = [pixels[0, 0], pixels[w - 1, 0], pixels[0, h - 1], pixels[w - 1, h - 1]]
    if all(c[3] < 20 for c in corners):
        return trim_transparent(rgba)

    # Punch near-black / very dark charcoal to transparent
    out = rgba.copy()
    px = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 10:
                continue
            # Dark charcoal background (brand plates)
            if r <= 18 and g <= 28 and b <= 28:
                px[x, y] = (0, 0, 0, 0)
            # Also kill near-pure black
            elif r <= 8 and g <= 8 and b <= 8:
                px[x, y] = (0, 0, 0, 0)
    return trim_transparent(out)


def write_icon_composer(mark: Image.Image) -> None:
    ICON_ASSETS.mkdir(parents=True, exist_ok=True)
    dest = ICON_ASSETS / "icon.png"
    # Icon Composer layer: transparent mark inside 80% + circular safe guides
    layer = fit_icon_guidelines(mark, 1024)
    layer.save(dest, "PNG", optimize=True)

    icon_json = ICON_DIR / "icon.json"
    icon_json.write_text(
        """{
  "fill": {
    "solid": "display-p3:0.00000,0.08627,0.09412,1.00000"
  },
  "groups": [
    {
      "layers": [
        {
          "glass": false,
          "image-name": "icon.png",
          "name": "icon",
          "position": {
            "scale": 1,
            "translation-in-points": [0, 0]
          }
        }
      ],
      "shadow": {
        "kind": "neutral",
        "opacity": 0.35
      },
      "translucency": {
        "enabled": true,
        "value": 0.45
      }
    }
  ],
  "supported-platforms": {
    "circles": ["watchOS"],
    "squares": "shared"
  }
}
""",
        encoding="utf-8",
    )
    print(f"Wrote {icon_json}")


def main() -> None:
    for name in ["icon-transparent.png", "gemfort-icon.png", "logo.png"]:
        inspect(IMAGES / name)

    transparent_src = IMAGES / "icon-transparent.png"
    mark = ensure_true_transparent(transparent_src)

    store_scale = max_scale_for_guidelines(mark, 1024)
    android_scale = max_scale_for_guidelines(mark, 1024, hard_cap=ANDROID_SAFE_FRAC)
    print(
        f"Guideline scales — store/iOS: {store_scale:.3f}  android FG (cap {ANDROID_SAFE_FRAC}): {android_scale:.3f}"
    )

    # In-app BrandMark master (slight padding only)
    fit_centered(mark, 1024, SCALE_IN_APP_MARK).save(
        IMAGES / "icon-transparent.png", "PNG", optimize=True
    )
    print("Saved cleaned icon-transparent.png")

    # App Store / generic / Android legacy icon
    opaque_icon(mark, 1024).save(IMAGES / "icon.png", "PNG", optimize=True)
    print("Saved icon.png")

    # iOS appearance variants
    opaque_icon(mark, 1024).save(IMAGES / "ios-light.png", "PNG", optimize=True)
    opaque_icon(mark, 1024).save(IMAGES / "ios-dark.png", "PNG", optimize=True)
    mono = monochrome_mark(mark, 1024).convert("RGBA")
    tinted_bg = Image.new("RGBA", (1024, 1024), (128, 128, 128, 255))
    tinted_bg.alpha_composite(mono)
    tinted_bg.convert("RGB").save(IMAGES / "ios-tinted.png", "PNG", optimize=True)
    print("Saved ios-light/dark/tinted.png")

    # Android adaptive — hard-capped to 66% safe zone (circular/squircle masks)
    fit_icon_guidelines(mark, 1024, hard_cap=ANDROID_SAFE_FRAC).save(
        IMAGES / "android-icon-foreground.png", "PNG", optimize=True
    )
    solid(BG_RGB).save(IMAGES / "android-icon-background.png", "PNG", optimize=True)
    monochrome_mark(mark, 1024).save(
        IMAGES / "android-icon-monochrome.png", "PNG", optimize=True
    )
    print("Saved android adaptive icons")

    fit_centered(mark, 1024, SCALE_SPLASH).save(IMAGES / "splash-icon.png", "PNG", optimize=True)
    print("Saved splash-icon.png")

    monochrome_mark(mark, 96, SCALE_NOTIFICATION).save(
        IMAGES / "notification-icon.png", "PNG", optimize=True
    )

    opaque_icon(mark, 48, SCALE_FAVICON).save(IMAGES / "favicon.png", "PNG", optimize=True)

    opaque_icon(mark, 1024, SCALE_MARKETING).save(IMAGES / "gemfort-icon.png", "PNG", optimize=True)

    logo = Image.open(IMAGES / "logo.png").convert("RGBA")
    logo.save(IMAGES / "logo.png", "PNG", optimize=True)

    write_icon_composer(mark)

    import math

    for label, path, is_opaque in [
        ("icon.png", IMAGES / "icon.png", True),
        ("android-fg", IMAGES / "android-icon-foreground.png", False),
        ("ios-layer", ICON_ASSETS / "icon.png", False),
    ]:
        if is_opaque:
            im = Image.open(path).convert("RGB")
            bg = BG_RGB
            px = im.load()
            w, h = im.size
            minx, miny, maxx, maxy = w, h, 0, 0
            for y in range(h):
                for x in range(w):
                    r, g, b = px[x, y]
                    if abs(r - bg[0]) > 8 or abs(g - bg[1]) > 8 or abs(b - bg[2]) > 8:
                        minx = min(minx, x)
                        miny = min(miny, y)
                        maxx = max(maxx, x)
                        maxy = max(maxy, y)
            bw, bh = maxx - minx + 1, maxy - miny + 1
        else:
            w_span, h_span = content_span(Image.open(path))
            bw, bh = w_span * 1024, h_span * 1024
            w = h = 1024
        circum = math.sqrt((bw / 2) ** 2 + (bh / 2) ** 2) / (1024 / 2)
        print(
            f"  {label}: h={bh/1024:.3f} w={bw/1024:.3f} "
            f"in_safe80={max(bw, bh)/1024 <= SAFE_AREA_FRAC + 0.001} "
            f"circle_r={circum:.3f} (limit {CIRCLE_RADIUS_FRAC})"
        )
    print("Done. bg:", SPLASH_BG)


if __name__ == "__main__":
    main()
