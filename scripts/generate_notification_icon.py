from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "donat-dankau-logo.png"
OUTPUT = ROOT / "assets" / "donat-dankau-logo.png"

# The donut mark is the second glyph in the full Donat Dankau wordmark.
DONUT_BOUNDS = (118, 208, 204, 272)
CANVAS_SIZE = 96
MARK_WIDTH = 72
DETAIL_THRESHOLD = 120


def keep_largest_component(alpha: Image.Image) -> Image.Image:
    pixels = alpha.load()
    visited: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []

    for y in range(alpha.height):
        for x in range(alpha.width):
            if (x, y) in visited or pixels[x, y] == 0:
                continue
            component: list[tuple[int, int]] = []
            pending = [(x, y)]
            visited.add((x, y))
            while pending:
                current_x, current_y = pending.pop()
                component.append((current_x, current_y))
                for next_y in range(max(0, current_y - 1), min(alpha.height, current_y + 2)):
                    for next_x in range(max(0, current_x - 1), min(alpha.width, current_x + 2)):
                        point = (next_x, next_y)
                        if point not in visited and pixels[next_x, next_y] > 0:
                            visited.add(point)
                            pending.append(point)
            components.append(component)

    cleaned = Image.new("L", alpha.size, 0)
    cleaned_pixels = cleaned.load()
    for x, y in max(components, key=len):
        cleaned_pixels[x, y] = pixels[x, y]
    return cleaned


def make_monochrome_alpha(mark: Image.Image, source_alpha: Image.Image) -> Image.Image:
    mark_pixels = mark.load()
    source_alpha_pixels = source_alpha.load()
    output = Image.new("L", mark.size, 0)
    output_pixels = output.load()

    for y in range(mark.height):
        for x in range(mark.width):
            red, green, blue, _ = mark_pixels[x, y]
            luminance = (299 * red + 587 * green + 114 * blue) // 1000
            detail_alpha = max(0, min(255, (luminance - DETAIL_THRESHOLD) * 5))
            output_pixels[x, y] = min(source_alpha_pixels[x, y], detail_alpha)
    return output


def main() -> None:
    with Image.open(SOURCE).convert("RGBA") as logo:
        mark = logo.crop(DONUT_BOUNDS)
        source_alpha = keep_largest_component(mark.getchannel("A"))
        alpha = make_monochrome_alpha(mark, source_alpha)
        mark = Image.new("RGBA", mark.size, "white")
        mark.putalpha(alpha)

        target_height = round(mark.height * MARK_WIDTH / mark.width)
        mark = mark.resize((MARK_WIDTH, target_height), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (CANVAS_SIZE, CANVAS_SIZE), (255, 255, 255, 0))
    position = ((CANVAS_SIZE - mark.width) // 2, (CANVAS_SIZE - mark.height) // 2)
    canvas.alpha_composite(mark, position)
    canvas.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
