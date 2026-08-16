from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps


SOURCE_DIR = Path(r"C:\Users\akare\Downloads")
OUTPUT_DIR = Path(r"C:\Users\akare\Documents\Codex_Mac_Projeleri\Projeler\jpp\output\portfolio-lighting")


# Tuned per camera angle. The edit is deliberately non-generative: geometry and
# objects remain pixel-identical while tonal and color response are improved.
PROFILES = {
    "5969787233730939224.jpg": dict(shadows=0.070, mids=0.015, highlights=0.050, local=0.115, warmth=0.020, saturation=1.040, vignette=0.015),
    "5969787233730939223.jpg": dict(shadows=0.095, mids=0.020, highlights=0.045, local=0.120, warmth=0.022, saturation=1.045, vignette=0.014),
    "5969787233730939222.jpg": dict(shadows=0.125, mids=0.025, highlights=0.035, local=0.125, warmth=0.024, saturation=1.045, vignette=0.012),
    "5969787233730939221.jpg": dict(shadows=0.205, mids=0.040, highlights=0.060, local=0.135, warmth=0.030, saturation=1.055, vignette=0.018),
    "5969787233730939229.jpg": dict(shadows=0.085, mids=0.020, highlights=0.055, local=0.115, warmth=0.018, saturation=1.055, vignette=0.017),
    "5969787233730939228.jpg": dict(shadows=0.180, mids=0.035, highlights=0.050, local=0.135, warmth=0.022, saturation=1.060, vignette=0.020),
    "5969787233730939227.jpg": dict(shadows=0.200, mids=0.040, highlights=0.065, local=0.140, warmth=0.030, saturation=1.055, vignette=0.018),
    "5969787233730939226.jpg": dict(shadows=0.190, mids=0.040, highlights=0.045, local=0.140, warmth=0.028, saturation=1.050, vignette=0.015),
}


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def grade(img: Image.Image, p: dict[str, float]) -> Image.Image:
    rgb = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    y = luminance(rgb)

    # Open dark interior areas with a smooth mask; near-black objects remain rich.
    shadow_mask = 1.0 - smoothstep(0.12, 0.64, y)
    black_protect = smoothstep(0.025, 0.12, y)
    y2 = y + p["shadows"] * shadow_mask * black_protect * (0.74 - 0.42 * y)

    # Gentle midtone exposure without flattening naturally bright surfaces.
    mid_mask = smoothstep(0.15, 0.40, y) * (1.0 - smoothstep(0.72, 0.94, y))
    y2 += p["mids"] * mid_mask

    # Soft highlight shoulder for curtains, ceilings and glossy white cabinetry.
    high_mask = smoothstep(0.70, 0.995, y2)
    y2 -= p["highlights"] * high_mask * np.maximum(y2 - 0.70, 0.0)

    # Refined S curve adds dimension after the shadow recovery.
    y2 += 0.032 * (y2 - 0.5) * 4.0 * y2 * (1.0 - y2)
    y2 = np.clip(y2, 0.0, 1.0)

    # Transfer the tone curve while retaining chroma and material color.
    ratio = (y2 + 0.008) / (y + 0.008)
    rgb = np.clip(rgb * ratio[..., None], 0.0, 1.0)

    # Warm only shadows and midtones; keep white walls and windows clean.
    y_now = luminance(rgb)
    warm_mask = (1.0 - smoothstep(0.72, 0.96, y_now))[..., None]
    warm_gain = np.array([1.0 + p["warmth"], 1.0 + p["warmth"] * 0.25, 1.0 - p["warmth"] * 0.70], dtype=np.float32)
    rgb *= 1.0 + warm_mask * (warm_gain - 1.0)

    # Controlled vibrance: strengthen burgundy/blue/green accents, not neutrals.
    y_now = luminance(rgb)[..., None]
    chroma = np.max(rgb, axis=2) - np.min(rgb, axis=2)
    vibrance = 1.0 + (p["saturation"] - 1.0) * (1.15 - 0.55 * chroma)
    rgb = y_now + (rgb - y_now) * vibrance[..., None]

    # Local clarity on broad architectural texture, blended conservatively.
    base_luma = luminance(np.clip(rgb, 0.0, 1.0))
    luma_img = Image.fromarray(np.uint8(np.clip(base_luma, 0, 1) * 255), mode="L")
    blur_radius = max(8.0, min(img.size) / 105.0)
    blurred = np.asarray(luma_img.filter(ImageFilter.GaussianBlur(blur_radius)), dtype=np.float32) / 255.0
    detail = np.clip(base_luma - blurred, -0.13, 0.13)
    target_luma = np.clip(base_luma + p["local"] * detail, 0.0, 1.0)
    ratio = (target_luma + 0.008) / (base_luma + 0.008)
    rgb = np.clip(rgb * ratio[..., None], 0.0, 1.0)

    # Very subtle edge falloff keeps attention on the designed interior.
    h, w = rgb.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    dx = (xx - (w - 1) / 2) / (w / 2)
    dy = (yy - (h - 1) / 2) / (h / 2)
    radial = np.clip((dx * dx + dy * dy - 0.36) / 0.95, 0.0, 1.0)
    rgb *= (1.0 - p["vignette"] * radial)[..., None]

    out = Image.fromarray(np.uint8(np.clip(rgb, 0.0, 1.0) * 255), mode="RGB")
    return out.filter(ImageFilter.UnsharpMask(radius=1.25, percent=48, threshold=3))


def make_contact_sheet(rows: list[tuple[str, Image.Image, Image.Image]]) -> Image.Image:
    thumb_w, thumb_h = 640, 360
    pad, label_h = 20, 34
    canvas = Image.new("RGB", (thumb_w * 2 + pad * 3, (thumb_h + label_h + pad) * len(rows) + pad), "#171717")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default(size=20)
    for i, (name, before, after) in enumerate(rows):
        y0 = pad + i * (thumb_h + label_h + pad)
        b = ImageOps.fit(before.convert("RGB"), (thumb_w, thumb_h), method=Image.Resampling.LANCZOS)
        a = ImageOps.fit(after.convert("RGB"), (thumb_w, thumb_h), method=Image.Resampling.LANCZOS)
        canvas.paste(b, (pad, y0))
        canvas.paste(a, (pad * 2 + thumb_w, y0))
        draw.text((pad, y0 + thumb_h + 7), f"ONCE  |  {name}", fill="#d2d2d2", font=font)
        draw.text((pad * 2 + thumb_w, y0 + thumb_h + 7), "SONRA  |  PORTFOY ISIGI", fill="#f3c47d", font=font)
    return canvas


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for filename, profile in PROFILES.items():
        source = SOURCE_DIR / filename
        if not source.exists():
            print(f"SKIP missing source: {source}")
            continue
        with Image.open(source) as original:
            original.load()
            result = grade(original, profile)
            destination = OUTPUT_DIR / f"{source.stem}-professional-lighting.jpg"
            result.save(destination, quality=96, subsampling=0, optimize=True)
            rows.append((source.stem, original.copy(), result))
            print(f"{filename} -> {destination.name} | {original.size[0]}x{original.size[1]}")

    sheet = make_contact_sheet(rows)
    sheet_path = OUTPUT_DIR / "remaining-8-before-after-contact-sheet.jpg"
    sheet.save(sheet_path, quality=92, subsampling=0, optimize=True)
    print(f"contact sheet -> {sheet_path.name}")


if __name__ == "__main__":
    main()
