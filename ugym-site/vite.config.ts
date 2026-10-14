import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/* ------------------------------------------------------------------
   Modo vitrine.

   `vite build --mode vitrine` troca três módulos por sósias sem rede:
   o banco, a conta e a foto. O resto do aplicativo, telas, store,
   cálculos, roteador, é exatamente o mesmo código que vai para o ar.

   Por que existe: o artefato do Gastô no claude.ai roda numa caixa que
   bloqueia conexão para fora, então lá o app nunca alcança o Supabase.
   Com a troca, dá para abrir o app inteiro no celular e clicar em tudo,
   com lançamentos de exemplo, antes de publicar de verdade.

   A troca é por caminho resolvido, e não por texto do import, para não
   pegar nenhum arquivo parecido por engano. Fora do modo vitrine o
   plugin não faz absolutamente nada.
-------------------------------------------------------------------*/

const TROCAS: Record<string, string> = {
  "src/lib/db.ts": "src/lib/db-vitrine.ts",
  "src/lib/supabase.ts": "src/lib/supabase-vitrine.ts",
  "src/lib/avatar.ts": "src/lib/avatar-vitrine.ts",
};

function vitrine(ligado: boolean): Plugin {
  const raiz = process.cwd();
  const mapa = new Map(
    Object.entries(TROCAS).map(([de, para]) => [path.resolve(raiz, de), path.resolve(raiz, para)])
  );

  return {
    name: "gasto-vitrine",
    enforce: "pre",
    async resolveId(origem, quemPediu, opcoes) {
      if (!ligado) return null;
      const achado = await this.resolve(origem, quemPediu, { ...opcoes, skipSelf: true });
      if (!achado) return null;
      const destino = mapa.get(path.normalize(achado.id.split("?")[0]));
      return destino ?? null;
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), vitrine(mode === "vitrine")],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
}));
