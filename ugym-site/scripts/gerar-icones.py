"""
Gera o ícone de tela inicial a partir da própria marca do Gastô.

O quadrado é sangrado, sem cantos arredondados e sem transparência: quem
arredonda é o iOS, e o iOS compõe transparência sobre preto, o que deixaria
uma borda escura feia. As proporções (marca ocupando 55% da altura, centrada
em 50,55% da altura) foram medidas na arte de referência.

    python3 scripts/gerar-icones.py

Precisa de cairosvg:  pip install cairosvg --break-system-packages
"""
import re
from pathlib import Path

import cairosvg

RAIZ = Path(__file__).resolve().parent.parent
PUBLIC = RAIZ / "public"

# os dois contornos do "g" vêm do favicon, que é a vetorização original
G_BODY, G_CUP = re.findall(r'd="([^"]+)"', (PUBLIC / "favicon.svg").read_text())[:2]

LADO = 512
ALTURA_MARCA = 0.5795  # em unidades do viewBox; dá 55% de tinta visível
ESCALA = ALTURA_MARCA * LADO / 468
TINTA = "#1d1d1d"

SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{LADO}" height="{LADO}" viewBox="0 0 {LADO} {LADO}">
<defs>
<linearGradient id="b" x1="0" y1="0" x2="0.18" y2="1">
<stop offset="0" stop-color="#63e06f"/><stop offset="0.35" stop-color="#42e657"/>
<stop offset="0.62" stop-color="#1fdd3c"/><stop offset="1" stop-color="#05a026"/></linearGradient>
<radialGradient id="g" cx="0.42" cy="0.44" r="0.56">
<stop offset="0" stop-color="#12FB3D" stop-opacity="1"/>
<stop offset="0.6" stop-color="#12FB3D" stop-opacity="0.35"/>
<stop offset="1" stop-color="#12FB3D" stop-opacity="0"/></radialGradient>
<linearGradient id="d" x1="0.05" y1="0.05" x2="1" y2="0.35">
<stop offset="0" stop-color="#00420d" stop-opacity="0"/>
<stop offset="1" stop-color="#00420d" stop-opacity="0.3"/></linearGradient>
</defs>
<rect width="{LADO}" height="{LADO}" fill="url(#b)"/>
<rect width="{LADO}" height="{LADO}" fill="url(#g)"/>
<rect width="{LADO}" height="{LADO}" fill="url(#d)"/>
<g transform="translate({LADO * 0.5} {LADO * 0.5055}) scale({ESCALA}) translate(-229 -290)">
<g transform="translate(0,580) scale(0.1,-0.1)">
<path d="{G_BODY}" fill="{TINTA}"/><path d="{G_CUP}" fill="{TINTA}"/></g></g></svg>"""

SAIDAS = [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)]

if __name__ == "__main__":
    (PUBLIC / "icon.svg").write_text(SVG)
    for nome, px in SAIDAS:
        cairosvg.svg2png(
            bytestring=SVG.encode(),
            write_to=str(PUBLIC / nome),
            output_width=px,
            output_height=px,
            background_color="#12FB3D",  # garante PNG sem canal alfa
        )
        print(f"{nome}  {px}x{px}")
