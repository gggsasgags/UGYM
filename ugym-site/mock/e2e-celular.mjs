/**
 * Layout no celular.
 *
 * O aplicativo instalado na tela inicial do iPhone ocupa a tela toda, por
 * baixo da barra de status. Estes testes garantem que nada escapa pela
 * lateral, que não existe mais barra superior e que o menu e a foto de
 * perfil ficam acessíveis, inclusive com o recorte do aparelho simulado.
 *
 *   node mock/e2e-celular.mjs <porta-do-app> <porta-do-mock>
 */
import { chromium } from "playwright";

const APP = "http://127.0.0.1:" + (process.argv[2] || 5199);
const MOCK = "http://127.0.0.1:" + (process.argv[3] || 54331);
const R = [];
const chk = (n, ok, d = "") => {
  R.push((ok ? "OK    " : "FALHA ") + n + (d ? "  ->  " + d : ""));
  console.log(R.at(-1));
};

/** 59px em cima e 34px embaixo é o recorte de um iPhone com Dynamic Island */
const TOPO = 59;
const RECORTE = `
  .shell .hello, .shell .scr__top { padding-top: calc(16px + ${TOPO}px) !important; }
  .drawer__panel { padding-top: calc(16px + ${TOPO}px) !important; }
  .sheet { padding-top: ${TOPO}px !important; }
  .confirm { padding-top: calc(20px + ${TOPO}px) !important; }
  .tabbar { padding-bottom: 34px !important; }
`;

await fetch(MOCK + "/__zerar", { method: "POST" });

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
page.on("pageerror", (e) => console.log("  [erro na página]", e.message));

const mail = "cel" + Date.now() + "@teste.dev";
await page.goto(APP + "/#/criar-conta");
await page.waitForSelector("#au-nome", { timeout: 15000 });
await page.fill("#au-nome", "Diego");
await page.fill("#au-email", mail);
await page.fill("#au-senha", "senha-de-teste-123");
await page.click('button:has-text("Com dados de exemplo")');
await page.click('button:has-text("Criar conta e começar")');
await page.waitForURL(/#\/app/, { timeout: 20000 });
await page.waitForTimeout(2500);

const ABAS = [
  ["Início", "/#/app"],
  ["Lançamentos", "/#/app/lancamentos"],
  ["Resumo", "/#/app/resumo"],
  ["Análises", "/#/app/analises"],
];

let n = 0;
for (const [nome, rota] of ABAS) {
  await page.goto(APP + rota);
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const fora = [];
    for (const el of document.querySelectorAll("body *")) {
      const bb = el.getBoundingClientRect();
      if (bb.right > de.clientWidth + 1.5 || bb.left < -1.5) {
        fora.push(el.tagName.toLowerCase() + "." + String(el.className || "").split(" ")[0]);
      }
    }
    const m = document.querySelector('[aria-label="Abrir menu"]');
    const mb = m && m.getBoundingClientRect();
    return {
      excede: de.scrollWidth - de.clientWidth,
      barra: Boolean(document.querySelector(".shell__bar")),
      menus: document.querySelectorAll('[aria-label="Abrir menu"]').length,
      menuNaTela: Boolean(mb && mb.top >= 0 && mb.right <= de.clientWidth && mb.width > 0),
      fora: fora.slice(0, 3),
    };
  });
  chk(`${++n}. ${nome}: nada escapa pela lateral`, r.excede === 0 && r.fora.length === 0,
    r.excede ? `sobra ${r.excede}px` : r.fora.join(", "));
  chk(`${++n}. ${nome}: sem barra superior`, !r.barra);
  /* O menu mora só na aba Início: nas outras ele seria ruído. */
  if (nome === "Início") chk(`${++n}. ${nome}: menu acessível`, r.menuNaTela);
  else chk(`${++n}. ${nome}: sem botão de menu`, r.menus === 0, "encontrados: " + r.menus);
}

/* ---------- topo da aba Lançamentos ---------- */
await page.goto(APP + "/#/app/lancamentos");
await page.waitForTimeout(1200);
const topo = await page.evaluate(() => {
  const t = document.querySelector(".scr__tools").getBoundingClientRect();
  const a = document.querySelector(".scr__add").getBoundingClientRect();
  const de = document.documentElement;
  return {
    iconesEsq: Math.round(t.left),
    addDir: Math.round(a.right),
    largura: de.clientWidth,
    mesmaLinha: Math.abs(t.top - a.top) < 12,
    addDepoisDosIcones: a.left > t.right + 40,
  };
});
chk(`${++n}. ícones ficam na esquerda`, topo.iconesEsq < 40, "começam em " + topo.iconesEsq + "px");
chk(`${++n}. "Adicionar" fica na direita`, topo.largura - topo.addDir < 40,
  "termina a " + (topo.largura - topo.addDir) + "px da borda");
chk(`${++n}. os dois na mesma faixa, sem se encostar`,
  topo.mesmaLinha && topo.addDepoisDosIcones);

/* ---------- com o recorte do aparelho simulado ---------- */
await page.goto(APP + "/#/app");
await page.waitForTimeout(1000);
await page.addStyleTag({ content: RECORTE });
await page.waitForTimeout(400);
const comRecorte = await page.evaluate(() => {
  const m = document.querySelector('[aria-label="Abrir menu"]').getBoundingClientRect();
  const a = document.querySelector('[aria-label="Seu perfil"]').getBoundingClientRect();
  return { menuTop: Math.round(m.top), avatarTop: Math.round(a.top) };
});
chk(`${++n}. menu abaixo da barra de status do iPhone`, comRecorte.menuTop >= 59,
  "topo do menu em " + comRecorte.menuTop + "px");
chk(`${++n}. foto de perfil abaixo da barra de status`, comRecorte.avatarTop >= 59,
  "topo da foto em " + comRecorte.avatarTop + "px");

/* ---------- o menu abre mesmo, e a foto leva ao perfil ---------- */
await page.click('[aria-label="Abrir menu"]');
await page.waitForSelector(".drawer", { timeout: 5000 });
chk(`${++n}. o menu abre a gaveta lateral`, (await page.locator(".drawer").count()) === 1);

const gaveta = await page.evaluate(() => {
  const cab = document.querySelector(".drawer__head").getBoundingClientRect();
  const foto = document.querySelector(".drawer__me .shell__avatar").getBoundingClientRect();
  const fechar = document.querySelector('.drawer__head [aria-label="Fechar"]').getBoundingClientRect();
  return { cabTop: Math.round(cab.top), fotoTop: Math.round(foto.top), fecharTop: Math.round(fechar.top) };
});
chk(`${++n}. o topo da gaveta não fica sob a barra de status`,
  gaveta.cabTop >= TOPO && gaveta.fotoTop >= TOPO && gaveta.fecharTop >= TOPO,
  `cabeçalho em ${gaveta.cabTop}px, foto em ${gaveta.fotoTop}px, fechar em ${gaveta.fecharTop}px`);
/* No celular a gaveta cobre quase toda a largura, então o jeito de fechar
   é o X do cabeçalho, não o pedacinho de fundo que sobra. */
await page.click('.drawer__head [aria-label="Fechar"]');
await page.waitForTimeout(500);
await page.click('[aria-label="Seu perfil"]');
await page.waitForSelector(".sheet", { timeout: 5000 });
const tituloPerfil = await page.locator(".sheet__head h2").innerText();
chk(`${++n}. a foto abre o perfil`, /perfil/i.test(tituloPerfil), tituloPerfil);
const folha = await page.evaluate(
  () => Math.round(document.querySelector(".sheet__panel").getBoundingClientRect().top)
);
chk(`${++n}. a folha modal também respeita o topo`, folha >= TOPO, "topo da folha em " + folha + "px");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

/* ---------- olhinho de privacidade ---------- */
const valorVisivel = async () =>
  (await page.locator(".hero__value").innerText()).replace(/\s+/g, " ").trim();

const antes = await valorVisivel();
chk(`${++n}. o total aparece antes de esconder`, /R\$\s?[\d.]+,\d{2}/.test(antes), antes);

await page.click('[aria-label="Esconder os valores"]');
await page.waitForTimeout(500);
const depois = await valorVisivel();
chk(`${++n}. o olhinho esconde o total`, !/\d/.test(depois), JSON.stringify(depois));

const borrados = await page.evaluate(() => {
  const alvos = [...document.querySelectorAll(".scr--home .ranklist__v, .scr--home .catbar__val .num, .scr--home .donut__val, .scr--home .legend__val")];
  const comBorrao = alvos.filter((e) => getComputedStyle(e).filter.includes("blur"));
  const contagem = document.querySelector(".scr--home .tagsoft:not(.num)");
  return {
    total: alvos.length,
    borrados: comBorrao.length,
    contagemLimpa: contagem ? !getComputedStyle(contagem).filter.includes("blur") : true,
  };
});
chk(`${++n}. os outros valores em dinheiro também somem`,
  borrados.total > 0 && borrados.borrados === borrados.total,
  borrados.borrados + " de " + borrados.total);
chk(`${++n}. contagem de dias continua legível`, borrados.contagemLimpa);

await page.reload();
await page.waitForSelector(".hero__value", { timeout: 15000 });
await page.waitForTimeout(1500);
chk(`${++n}. continua escondido depois de fechar e abrir`,
  (await page.locator('[aria-label="Mostrar os valores"]').count()) === 1);

await page.click('[aria-label="Mostrar os valores"]');
await page.waitForTimeout(500);
const devolta = await valorVisivel();
chk(`${++n}. clicar de novo devolve o valor`, /R\$\s?[\d.]+,\d{2}/.test(devolta), devolta);

/* ---------- rolar não pode empurrar a página para o lado ---------- */
await page.evaluate(() => window.scrollTo(0, 600));
await page.waitForTimeout(400);
const depoisDeRolar = await page.evaluate(() => ({
  x: window.scrollX,
  excede: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}));
chk(`${++n}. rolar não desloca a tela na horizontal`,
  depoisDeRolar.x === 0 && depoisDeRolar.excede === 0,
  "scrollX=" + depoisDeRolar.x + " sobra=" + depoisDeRolar.excede + "px");

/* ---------- telas estreitas de verdade ---------- */
for (const largura of [320, 360, 430]) {
  await page.setViewportSize({ width: largura, height: 780 });
  await page.waitForTimeout(600);
  const excede = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  chk(`${++n}. cabe em ${largura}px de largura`, excede === 0, "sobra " + excede + "px");
}

await b.close();
const f = R.filter((x) => x.startsWith("FALHA"));
console.log(`\n${R.length - f.length} passaram, ${f.length} falharam.`);
process.exit(f.length ? 1 : 0);
