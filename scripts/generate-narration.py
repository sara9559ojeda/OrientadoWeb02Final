"""Genera las grabaciones de Aurora (public/audio/narration/*.mp3) a partir de NARRATION.

El texto sale de src/story.js (única fuente), así que audio y subtítulos no se desincronizan.
Usa una voz neuronal de Microsoft mediante el paquete `edge-tts` (necesita internet SOLO al
generar; el juego reproduce los mp3 ya guardados y no depende de nada externo).

Uso (desde la raíz del proyecto):

    python -m venv .tts-venv
    .tts-venv/Scripts/python -m pip install edge-tts        # en Linux/macOS: .tts-venv/bin/python
    .tts-venv/Scripts/python scripts/generate-narration.py

Para cambiar la voz basta con editar VOICE (ver todas: `python -m edge_tts --list-voices`).
Las frases con variantes (lista en NARRATION) se guardan como `<id>-0.mp3`, `<id>-1.mp3`…
Solo se regeneran los audios cuyo texto cambió (se guarda un hash en manifest.json);
con --force se regeneran todos.
"""
import asyncio
import hashlib
import json
import subprocess
import sys
from pathlib import Path

import edge_tts

VOICE = "es-MX-DaliaNeural"  # femenina, cálida, acento neutro. Alternativa colombiana: es-CO-SalomeNeural
RATE = "-4%"  # un punto más pausada: voz de guía tranquila
PITCH = "+0Hz"

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio" / "narration"
MANIFEST = OUT / "manifest.json"


def load_narration() -> dict:
    """Lee NARRATION de src/story.js con Node (el proyecto ya lo necesita)."""
    code = "import('./src/story.js').then(m => console.log(JSON.stringify(m.NARRATION)))"
    result = subprocess.run(["node", "-e", code], cwd=ROOT, capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def flatten(narration: dict) -> dict:
    """{ 'gameOver': [a, b] } -> { 'gameOver-0': a, 'gameOver-1': b }"""
    files = {}
    for key, value in narration.items():
        if isinstance(value, list):
            for i, text in enumerate(value):
                files[f"{key}-{i}"] = text
        else:
            files[key] = value
    return files


def digest(text: str) -> str:
    return hashlib.sha1(f"{VOICE}|{RATE}|{PITCH}|{text}".encode("utf-8")).hexdigest()[:12]


async def main(force: bool) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    files = flatten(load_narration())
    old = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    manifest = {}

    for name, text in files.items():
        path = OUT / f"{name}.mp3"
        h = digest(text)
        manifest[name] = h
        if not force and path.exists() and old.get(name) == h:
            print(f"= {name}.mp3 (sin cambios)")
            continue
        await edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH).save(str(path))
        print(f"+ {name}.mp3  {path.stat().st_size // 1024} KB  «{text[:50]}»")

    # Borra audios de frases que ya no existen en el guion
    for stale in OUT.glob("*.mp3"):
        if stale.stem not in files:
            stale.unlink()
            print(f"- {stale.name} (ya no está en el guion)")

    # El manifiesto también le dice al juego qué audios existen
    MANIFEST.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    print(f"\n{len(files)} frases · voz {VOICE} · {OUT}")


if __name__ == "__main__":
    asyncio.run(main("--force" in sys.argv))
