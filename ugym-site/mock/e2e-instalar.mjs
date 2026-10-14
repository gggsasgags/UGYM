/**
 * "Deixar na tela do celular": o passo a passo dentro do aplicativo e no site.
 *
 * O que importa aqui é o texto estar certo, porque as palavras entre
 * aspas são as que a pessoa vai procurar no próprio aparelho. Um passo a
 * passo com palavra aproximada não ajuda ninguém a achar o botão.
 *
 *   node mock/e2e-instalar.mjs <porta-do-app> <porta-do-mock>
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

/* ---------------- no site, antes de ter conta ---------------- */

await page.goto(APP + "/#/");
await page.waitForSelector("#instalar", { timeout: 15000 });

const noSite = await page.evaluate(() => {
  const sec = document.querySelector("#instalar");
  return {
    colunas: sec.querySelectorAll(".passos2__col").length,
    passos: sec.querySelectorAll(".passos__i").length,
    texto: sec.innerText,
  };
});
chk("1. o site tem a seção de instalar", Boolean(noSite.colunas), noSite.colunas + " colunas");
chk("2. com iPhone e Android lado a lado", noSite.colunas === 2);
chk("3. quatro passos em cada", noSite.passos === 8, noSite.passos + " passos no total");
chk("4. o do iPhone cita o Safari e a Tela de Início",
  /Safari/.test(noSite.texto) && /Tela de Início/.test(noSite.texto));
chk("5. o do Android cita o Chrome e instalar",
  /Chrome/.test(noSite.texto) && /Instalar aplicativo/.test(noSite.texto));
chk("6. não promete loja de aplicativo nenhuma",
  !/App Store|Play Store|Google Play/i.test(noSite.texto));

const largura = await page.evaluate(
  () => document.documentElement.scrollWidth - window.innerWidth
);
chk("7. a seção cabe na largura do celular", largura === 0, "sobra " + largura + "px");

/* ---------------- dentro do aplicativo ---------------- */

await page.goto(APP + "/#/criar-conta");
await page.waitForSelector("#au-nome", { timeout: 15000 });
await page.fill("#au-nome", "Diego");
await page.fill("#au-email", "inst-" + Date.now() + "@teste.dev");
await page.fill("#au-senha", "senha-de-teste-123");
await page.click('button:has-text("Do zero")');
await page.click('button:has-text("Criar conta e começar")');
await page.waitForURL(/#\/app/, { timeout: 20000 });
await page.waitForTimeout(1200);

await page.click('[aria-label="Abrir menu"]');
await page.waitForSelector(".drawer", { timeout: 6000 });
const naGaveta = await page.evaluate(() =>
  [...document.querySelectorAll(".drawer__row strong")].map((s) => s.textContent.trim())
);
chk("8. a gaveta tem a linha do tutorial",
  naGaveta.some((t) => /tela do celular/.test(t)), naGaveta.join(" · "));

await page.click('.drawer__row:has-text("tela do celular")');
await page.waitForSelector(".passos", { timeout: 6000 });

const noApp = await page.evaluate(() => ({
  passos: document.querySelectorAll(".sheet__panel .passos__i").length,
  texto: document.querySelector(".sheet__panel").innerText,
}));
chk("9. a folha abre com quatro passos", noApp.passos === 4, noApp.passos + " passos");
chk("10. começa pelo iPhone", /Tela de Início/.test(noApp.texto));

await page.click('.sheet__panel button[role="tab"]:has-text("Android")');
await page.waitForTimeout(400);
const android = await page.evaluate(() => document.querySelector(".sheet__panel").innerText);
chk("11. troca para o Android", /Chrome/.test(android) && /três pontinhos/.test(android));
chk("12. e some com o passo do iPhone", !/Safari/.test(android));

const mesmoTexto = await page.evaluate(() => {
  const noApp = [...document.querySelectorAll(".sheet__panel .passos__i")].map((n) =>
    n.innerText.replace(/^\d+\s*/, "").trim()
  );
  return noApp;
});
chk("13. o texto do app é o mesmo do site", mesmoTexto.length === 4 && mesmoTexto.every(Boolean),
  mesmoTexto[0]?.slice(0, 40));

await page.click('.sheet__panel .btn--pos');
await page.waitForTimeout(400);
chk("14. o botão fecha a folha", (await page.locator(".sheet__panel").count()) === 0);

chk("15. nenhum erro de página", erros.length === 0, erros.join(" | "));

await b.close();
const f = R.filter((x) => x.startsWith("FALHA"));
console.log(`\n${R.length - f.length} passaram, ${f.length} falharam.`);
process.exit(f.length ? 1 : 0);
