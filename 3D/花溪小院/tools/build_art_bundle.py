"""Package approved PNG artwork as origin-safe data URLs for file:// WebGL."""
from pathlib import Path
import base64
import json

root = Path(__file__).resolve().parents[1]
files = {
    "plate": root / "assets/art/garden-plate-v2-dry.png",
    "waterfall": root / "assets/art/waterfall-v1.png",
    "botanicals": root / "assets/art/botanicals-v1.png",
}
assets = {
    name: "data:image/png;base64," + base64.b64encode(path.read_bytes()).decode()
    for name, path in files.items()
}
output = root / "assets/illustrations.js"
output.write_text(
    "/* Local artwork bundle; rebuild with tools/build_art_bundle.py. */\n"
    + "window.GARDEN_ART="
    + json.dumps(assets, separators=(",", ":"))
    + ";\n",
    encoding="utf-8",
)
print(f"Packaged {len(assets)} illustrations: {output.stat().st_size:,} bytes")
