"""Genera los PNG de la extensión desde el diseño geométrico de la marca."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "icons"
SIZES = (16, 32, 48, 128)
SCALE = 8


def rounded_line(draw, points, fill, width):
    draw.line(points, fill=fill, width=width, joint="curve")
    radius = width // 2
    for x, y in (points[0], points[-1]):
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def create_icon(size):
    canvas_size = size * SCALE
    image = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    green = "#196c4a"
    white = "#ffffff"
    corner = round(canvas_size * 30 / 128)
    draw.rounded_rectangle(
        (0, 0, canvas_size - 1, canvas_size - 1),
        radius=corner,
        fill=green,
    )

    def point(x, y):
        return round(x * canvas_size / 128), round(y * canvas_size / 128)

    stroke = max(round(9 * canvas_size / 128), SCALE)
    house = [
        point(26, 60.5),
        point(64, 29),
        point(102, 60.5),
        point(102, 95.5),
        point(94.5, 103),
    ]
    rounded_line(draw, house, white, stroke)
    rounded_line(
        draw,
        [point(26, 60.5), point(26, 95.5), point(33.5, 103)],
        white,
        stroke,
    )
    rounded_line(draw, [point(33.5, 103), point(52, 103)], white, stroke)
    rounded_line(draw, [point(76, 103), point(94.5, 103)], white, stroke)
    rounded_line(draw, [point(52, 103), point(52, 76), point(76, 76), point(76, 103)], white, stroke)

    return image.resize((size, size), Image.Resampling.LANCZOS)


if __name__ == "__main__":
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for icon_size in SIZES:
        output = OUTPUT_DIR / f"icon-{icon_size}.png"
        create_icon(icon_size).save(output, optimize=True)
        print(output)
