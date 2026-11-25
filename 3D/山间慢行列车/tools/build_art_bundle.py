import base64
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
art = {
    p.stem: "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()
    for p in sorted((root / "assets/art").glob("*.png"))
}
(root / "assets/art.js").write_text(
    "window.TRAIN_ART=" + json.dumps(art, separators=(",", ":")) + ";\n"
)
