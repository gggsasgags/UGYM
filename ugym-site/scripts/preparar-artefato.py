#!/usr/bin/env python3
"""
Prepara a pasta publish/, que é o que vai para o artefato do Gastô no
claude.ai (o link fixado, para o Diego ver o site pelo celular).

Três coisas que este script faz e que é fácil esquecer se for na mão:

1. Constrói no MODO VITRINE, que troca banco, conta e foto por sósias sem
   rede (veja o vite.config.ts). É obrigatório: a caixa onde o artefato
   roda bloqueia conexão para fora, então com a construção normal o app
   ficaria em "não conseguimos falar com o servidor" para sempre. Nenhuma
   chave entra no pacote, porque nesse modo nem existe cliente do Supabase.

   A bandeira "--com-chaves" faz o contrário, uma construção de verdade com
   a chave pública, para quando o destino não for o artefato. A chave
   secreta não entra aqui nunca, em modo nenhum.

2. Escreve o publish/gasto.html, que é o index.html da construção sem
   doctype, <html> e <head>: o artefato põe esse esqueleto por fora, e
   duplicar quebra a página.

3. Tira o único byte ESC (0x1b) de dentro do worker do pdf.js. O
   publicador recusa arquivo de texto com sequência de escape, e o byte
   está ali só como conteúdo de uma string. Trocar o byte cru pelos quatro
   caracteres \\x1b dá exatamente a mesma string em JavaScript.

Uso: python3 scripts/preparar-artefato.py
"""
import pathlib, shutil, subprocess, sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
DIST = RAIZ / "dist"
PUBLISH = RAIZ / "publish"
ENV = RAIZ / ".env.local"
ENV_GUARDADO = RAIZ / ".env.local.guardado"  # sobra da versão anterior, mantido por segurança

PAGINA = """<title>Gastô</title>
<meta name="description" content="Gastô: clareza sobre para onde vai o seu dinheiro. Controle de gastos fixos e variáveis, resumo mensal e uma nota que explica o próprio resultado." />
<meta name="theme-color" content="#0d1110" />
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png?v=2" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="Gastô" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap" />
<link rel="stylesheet" href="assets/index.css" />
<div id="root"></div>
<script type="module" src="assets/app.js"></script>
"""

SOLTOS = ["apple-touch-icon.png", "favicon.svg", "icon-192.png", "icon-512.png", "icons.svg"]


def construir(com_chaves: bool) -> None:
    subprocess.run(["npx", "tsc", "-b"], cwd=RAIZ, check=True)
    if com_chaves:
        subprocess.run(["npx", "vite", "build"], cwd=RAIZ, check=True)
        return
    # modo vitrine: sem rede, e por isso sem chave nenhuma no pacote
    subprocess.run(["npx", "vite", "build", "--mode", "vitrine"], cwd=RAIZ, check=True)


def limpar_escape() -> None:
    for arquivo in (PUBLISH / "assets").glob("*.mjs"):
        bruto = arquivo.read_bytes()
        if b"\x1b" in bruto:
            arquivo.write_bytes(bruto.replace(b"\x1b", rb"\x1b"))
            print("ESC trocado em", arquivo.name)


def main() -> None:
    com_chaves = "--com-chaves" in sys.argv
    print("modo:", "construção normal, com a chave pública" if com_chaves else "vitrine, sem rede e sem chave")
    construir(com_chaves)
    shutil.rmtree(PUBLISH / "assets", ignore_errors=True)
    shutil.copytree(DIST / "assets", PUBLISH / "assets")
    for nome in SOLTOS:
        shutil.copy(DIST / nome, PUBLISH / nome)
    (PUBLISH / "gasto.html").write_text(PAGINA)
    limpar_escape()
    print("pronto: publish/ com", sum(1 for _ in PUBLISH.rglob("*") if _.is_file()), "arquivos")


if __name__ == "__main__":
    sys.exit(main())
