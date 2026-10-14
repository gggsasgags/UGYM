/**
 * Ajustes pedidos depois que o app entrou em uso de verdade:
 *
 *  - recorrência é conceito de despesa, some das receitas
 *  - as categorias que vêm prontas podem ser apagadas, com volta
 *  - "Outros" aparece uma vez só, mesmo com lançamentos órfãos
 *  - importar e exportar viram um botão só
 *  - as folhas abrem centralizadas, inclusive no celular
 *  - o seletor de emoji tem busca e muito mais opção
 *
 *   node mock/e2e-ajustes.mjs <porta-do-app> <porta-do-mock>
 */
import { chromium } from "playwright";

const APP = "http://127.0.0.1:" + (process.argv[2] || 5199);
const MOCK = "http://127.0.0.1:" + (process.argv[3] || 54331);
const R = [];
const chk = (n, ok, d = "") => {
  R.push((ok ? "OK    " : "FALHA ") + n + (d ? "  ->  " + d : ""));
  console.log(R.at(-1));
};

await fetch(MOCK + "/__zerar", { method: "POST" });

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(e.message));

const email = "aj-" + Date.now() + "@teste.dev";
await page.goto(APP + "/#/criar-conta");
await page.waitForSelector("#au-nome", { timeout: 15000 });
await page.fill("#au-nome", "Diego");
await page.fill("#au-email", email);
await page.fill("#au-senha", "senha-de-teste-123");
await page.click('button:has-text("Com dados de exemplo")');
await page.click('button:has-text("Criar conta e começar")');
await page.waitForURL(/#\/app/, { timeout: 20000 });
await page.waitForTimeout(3000);

/* ═════════ 1. receita sem fixo e variável ═════════ */

await page.goto(APP + "/#/app/lancamentos");
await page.waitForTimeout(900);
await page.click(".scr__add");
await page.waitForSelector("#nl-desc", { timeout: 6000 });

const naDespesa = await page.evaluate(() =>
  document.querySelector(".sheet__panel").innerText.includes("Tipo de gasto")
);
chk("1. despesa continua perguntando fixo ou variável", naDespesa === true);

await page.click('button[role="tab"]:has-text("Receita")');
await page.waitForTimeout(300);
const naReceita = await page.evaluate(() => {
  const t = document.querySelector(".sheet__panel").innerText;
  return { tipo: t.includes("Tipo de gasto"), fixo: /\bFixo\b/.test(t) };
});
chk("2. receita não pergunta fixo nem variável", naReceita.tipo === false);
chk("3. e a palavra Fixo some da folha", naReceita.fixo === false);

await page.fill("#nl-desc", "Bônus do trimestre");
await page.fill("#nl-valor", "1200,00");
await page.click('button[type="submit"]:has-text("Salvar lançamento")');
await page.waitForTimeout(1000);

const naLista = await page.evaluate(() => {
  const linha = [...document.querySelectorAll(".trow")].find((r) =>
    r.innerText.includes("Bônus do trimestre")
  );
  return {
    achou: Boolean(linha),
    chip: linha ? linha.querySelectorAll(".chip").length : -1,
  };
});
chk("4. a receita entrou na lista", naLista.achou);
chk("5. sem etiqueta de fixo ou variável na linha", naLista.chip === 0, naLista.chip + " etiquetas");

/* o filtro de recorrência é filtro de gasto */
await page.click('[aria-label="Filtros"]');
await page.waitForTimeout(400);
await page.selectOption("#f-rec", "fixo");
await page.waitForTimeout(500);
const filtrado = await page.evaluate(() =>
  [...document.querySelectorAll(".trow")].some((r) => r.innerText.includes("Bônus do trimestre"))
);
chk("6. filtrar por gastos fixos não traz receita junto", filtrado === false);
await page.selectOption("#f-rec", "todos");
await page.waitForTimeout(400);

/* ═════════ 2. um botão só para arquivo ═════════ */

const icones = await page.evaluate(() => ({
  importar: document.querySelectorAll('[aria-label="Importar extrato"]').length,
  exportar: document.querySelectorAll('[aria-label="Exportar planilha"]').length,
  junto: document.querySelectorAll('[aria-label="Importar ou exportar"]').length,
}));
chk("7. os dois ícones viraram um", icones.importar === 0 && icones.exportar === 0 && icones.junto === 1,
  JSON.stringify(icones));

await page.click('[aria-label="Importar ou exportar"]');
await page.waitForSelector(".arqmenu", { timeout: 6000 });
const escolha = await page.evaluate(() => {
  const m = document.querySelector(".arqmenu");
  const cx = m.getBoundingClientRect();
  return {
    opcoes: m.querySelectorAll(".arqmenu__i").length,
    texto: m.innerText,
    largura: Math.round(cx.width),
    altura: Math.round(cx.height),
  };
});
chk("8. o botão abre as duas escolhas", escolha.opcoes === 2, escolha.opcoes + " opções");
chk("8b. num menuzinho, não num painel",
  escolha.largura <= 260 && escolha.altura <= 110,
  `${escolha.largura}x${escolha.altura}px`);
chk("9. com os nomes por extenso",
  /Importar extrato/.test(escolha.texto) && /Exportar planilha/.test(escolha.texto));

await page.click('.arqmenu__i:has-text("Exportar planilha")');
await page.waitForSelector(".exp__lista", { timeout: 8000 });
chk("10. exportar por ali abre a escolha de meses", true);
await page.click('.sheet__head [aria-label="Fechar"]');
await page.waitForTimeout(400);

/* ═════════ 3. folhas centralizadas no celular ═════════ */

await page.goto(APP + "/#/app");
await page.waitForTimeout(900);
await page.click('[aria-label="Seu perfil"]');
await page.waitForSelector(".sheet__panel", { timeout: 6000 });
// a folha entra deslizando; medir antes do fim da animação daria falso
await page.waitForTimeout(500);
const centro = await page.evaluate(() => {
  const p = document.querySelector(".sheet__panel").getBoundingClientRect();
  return {
    acima: Math.round(p.top),
    abaixo: Math.round(window.innerHeight - p.bottom),
  };
});
chk("11. a folha do perfil fica centrada, não colada embaixo",
  Math.abs(centro.acima - centro.abaixo) <= 24,
  `${centro.acima}px em cima, ${centro.abaixo}px embaixo`);
await page.click('.sheet__head [aria-label="Fechar"]');
await page.waitForTimeout(400);

await page.click(".hello__meta");
await page.waitForSelector(".share", { timeout: 6000 });
await page.waitForTimeout(500);
const cartao = await page.evaluate(() => {
  const p = document.querySelector(".sharewrap").getBoundingClientRect();
  return {
    acima: Math.round(p.top),
    abaixo: Math.round(window.innerHeight - p.bottom),
  };
});
chk("12. o cartão da nota também fica centrado",
  Math.abs(cartao.acima - cartao.abaixo) <= 24,
  `${cartao.acima}px em cima, ${cartao.abaixo}px embaixo`);
await page.click('.share__close');
await page.waitForTimeout(400);

/* ═════════ 4. apagar categoria que vem pronta ═════════ */

await page.click('[aria-label="Abrir menu"]');
await page.waitForSelector(".drawer", { timeout: 6000 });
await page.click('.drawer__row:has-text("Categorias")');
await page.waitForSelector(".catlist", { timeout: 6000 });

const travas = await page.evaluate(() => {
  const botoes = [...document.querySelectorAll('[aria-label^="Apagar "]')];
  return {
    total: botoes.length,
    travados: botoes.filter((b) => b.disabled).map((b) => b.getAttribute("aria-label")),
  };
});
chk("13. só 'Outros' continua protegida",
  travas.travados.length === 1 && /Outros/.test(travas.travados[0]),
  travas.travados.join(", ") || "nenhuma travada");

await page.click('[aria-label="Apagar Academia"]');
await page.waitForSelector(".confirm", { timeout: 6000 });
const pergunta = await page.evaluate(() => document.querySelector(".confirm").innerText);
chk("14. apagar pergunta antes e explica para onde vai o lançamento",
  /Outros/.test(pergunta), pergunta.split("\n").slice(0, 3).join(" · "));

await page.click('.confirm button:has-text("Apagar a categoria")');
await page.waitForTimeout(1200);

const depois = await (await fetch(MOCK + "/__estado")).json();
chk("15. a categoria base saiu do banco",
  !depois.categories.some((c) => c.slug === "academia"),
  depois.categories.length + " categorias");
chk("16. o lançamento dela virou Outros",
  depois.transactions.filter((t) => t.category === "academia").length === 0);

const volta = await page.evaluate(() => {
  const l = [...document.querySelectorAll(".minilink")].find((b) => /Restaurar/.test(b.innerText));
  return l ? l.innerText.trim() : "";
});
chk("17. aparece o caminho de volta", /Restaurar/.test(volta), volta);

await page.click('.minilink:has-text("Restaurar")');
await page.waitForTimeout(1200);
const restaurado = await (await fetch(MOCK + "/__estado")).json();
chk("18. restaurar traz a categoria de volta",
  restaurado.categories.some((c) => c.slug === "academia"));

await page.click('.sheet__head [aria-label="Fechar"]');
await page.waitForTimeout(400);

/* ═════════ 5. emoji com busca ═════════ */

await page.click('[aria-label="Abrir menu"]');
await page.waitForSelector(".drawer", { timeout: 6000 });
await page.click('.drawer__row:has-text("Categorias")');
await page.waitForSelector(".catlist", { timeout: 6000 });
await page.click('button:has-text("Nova categoria")');
await page.waitForSelector(".emojipick", { timeout: 6000 });

const quantos = await page.locator(".emojipick .emojis__i").count();
chk("19. o seletor traz bem mais emoji do que antes", quantos > 60, quantos + " emojis");

const grupos = await page.locator(".emojipick__g").count();
chk("20. e vêm separados por assunto", grupos >= 6, grupos + " grupos");

await page.fill('.emojipick__busca input', "cachorro");
await page.waitForTimeout(400);
const busca = await page.evaluate(() =>
  [...document.querySelectorAll(".emojipick .emojis__i")].map((b) => b.textContent.trim())
);
chk("21. a busca por palavra acha o emoji", busca.includes("🐶"), busca.join(" "));

await page.click('.emojipick .emojis__i:has-text("🐶")');
await page.waitForTimeout(300);
const escolhido = await page.evaluate(
  () => document.querySelector(".inlinecat__emoji").value
);
chk("22. escolher o emoji preenche o campo", escolhido === "🐶", escolhido);

/* ═════════ 6. órfãos não viram vários "Outros" ═════════ */

/* Planta lançamentos apontando para categorias que não existem, que é o
   estado em que a conta dele ficou depois de importar extrato numa
   versão antiga. Na tela isso tem que virar UMA linha "Outros". */
await page.click('.sheet__head [aria-label="Fechar"]').catch(() => {});
await page.waitForTimeout(300);

const hoje = new Date();
const ym = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
const fantasmas = ["banco-do-brasil-transferenci-", "loja-x-", "ghost-tres"];
const plantio = await (
  await fetch(MOCK + "/__plantar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactions: fantasmas.map((slug, i) => ({
        id: crypto.randomUUID(),
        description: "Órfão " + (i + 1),
        amount: 10 + i,
        kind: "despesa",
        category: slug,
        date: `${ym}-1${i}`,
        recurrence: "variavel",
        installment_current: null,
        installment_total: null,
        series_id: null,
      })),
    }),
  })
).json();
chk("24. plantei três lançamentos órfãos", plantio.plantados === 3, JSON.stringify(plantio));

await page.reload();
await page.waitForTimeout(2500);
await page.goto(APP + "/#/app/resumo");
await page.waitForTimeout(1200);
await page.click('button[role="tab"]:has-text("Modo planilha")');
await page.waitForTimeout(900);

const planilha = await page.evaluate(() =>
  [...document.querySelectorAll(".grid tbody th.grid__cat")].map((n) => n.innerText.trim())
);
const quantosOutros = planilha.filter((n) => /Outros/.test(n)).length;
chk("25. o modo planilha mostra uma única linha Outros", quantosOutros === 1,
  quantosOutros + " linhas: " + planilha.join(" | "));

const arrumado = await (await fetch(MOCK + "/__estado")).json();
const sobraram = arrumado.transactions.filter((t) => fantasmas.includes(t.category)).length;
chk("26. e os lançamentos órfãos foram religados no banco", sobraram === 0,
  sobraram + " ainda apontando para o nada");
chk("27. sem apagar nenhum deles",
  arrumado.transactions.filter((t) => /^Órfão/.test(t.description)).length === 3);

chk("28. nenhum erro de página no caminho todo", erros.length === 0, erros.join(" | "));

await b.close();
const f = R.filter((x) => x.startsWith("FALHA"));
console.log(`\n${R.length - f.length} passaram, ${f.length} falharam.`);
process.exit(f.length ? 1 : 0);
