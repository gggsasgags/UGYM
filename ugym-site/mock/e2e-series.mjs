/**
 * Até onde uma série vai no tempo.
 *
 * O defeito que originou este arquivo: o Diego criou o salário como
 * receita, marcou "todo mês", marcou "parar em algum mês" num mês de
 * 2027, e o lançamento ficou só no mês corrente. Os meses marcados
 * apareciam vazios, apesar de o formulário prometer "vai de outubro a
 * dezembro".
 *
 * A regra que vale agora, e que estes testes seguram:
 *
 *   - série sem fim      -> nasce até o mês corrente, e mais nada
 *   - série com fim      -> nasce até o fim, mesmo que ele seja futuro
 *   - mês futuro na tela -> mostra o que está marcado, e nenhuma nota
 *
 *   node mock/e2e-series.mjs <porta-do-app> <porta-do-mock>
 */
import { chromium } from "playwright";

const APP = "http://127.0.0.1:" + (process.argv[2] || 5199);
const MOCK = "http://127.0.0.1:" + (process.argv[3] || 54331);

const R = [];
const chk = (n, ok, d = "") => {
  R.push((ok ? "OK    " : "FALHA ") + n + (d ? "  ->  " + d : ""));
  console.log(R[R.length - 1]);
  return ok;
};
const estado = async () => (await fetch(MOCK + "/__estado")).json();

const shift = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const t = (y * 12 + (m - 1)) + n;
  return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0");
};

await fetch(MOCK + "/__zerar", { method: "POST" });

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("  [erro na página]", e.message));

const hoje = new Date();
const ym = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0");
const fim = shift(ym, 14);
const mail = "diego+serie" + Date.now() + "@teste.dev";

/* ------------------------------- cadastro -------------------------------- */
await page.goto(APP + "/#/criar-conta");
await page.fill("#au-nome", "Diego");
await page.fill("#au-email", mail);
await page.fill("#au-senha", "senha-de-teste-123");
await page.click('button[aria-pressed="false"]:has-text("Do zero")').catch(() => {});
await page.click('button:has-text("Criar conta e começar")');
await page.waitForURL(/#\/app/, { timeout: 15000 });
await page.click('.tab:has-text("Lançamentos")');
await page.waitForTimeout(400);

/* ------------- 1. salário todo mês, parando num mês de 2027 -------------- */
await page.click('button:has-text("Adicionar")');
await page.waitForSelector("#nl-desc", { timeout: 8000 });
await page.click('button[role="tab"]:has-text("Receita")').catch(() => {});
await page.fill("#nl-desc", "Salário");
await page.fill("#nl-valor", "4000,00");
await page.click('button[role="tab"]:has-text("Todo mês")');
await page.click('text=Parar em algum mês');
await page.waitForSelector("#nl-fim", { timeout: 5000 });
await page.fill("#nl-fim", fim);
await page.click('button:has-text("Salvar lançamento")');
await page.waitForTimeout(1200);

let st = await estado();
const serie = st.series.find((s) => s.kind === "mensal");
chk("1. série mensal gravada com o mês de parada", !!serie && serie.ended_ym === fim,
  serie ? "ended_ym=" + serie.ended_ym + " (esperado " + fim + ")" : "não criou série");

const doSalario = st.transactions.filter((t) => t.series_id === serie?.id);
const meses = [...new Set(doSalario.map((t) => t.date.slice(0, 7)))].sort();
chk("2. nasceu em todos os meses marcados, do atual até o fim",
  meses.length === 15 && meses[0] === ym && meses[meses.length - 1] === fim,
  meses.length + " meses, de " + meses[0] + " a " + meses[meses.length - 1]);

chk("3. nenhum mês além do fim marcado", meses.every((m) => m <= fim),
  "último = " + meses[meses.length - 1]);

/* ---------- 2. um fixo sem fim continua parando no mês corrente ---------- */
await page.click('button:has-text("Adicionar")');
await page.waitForSelector("#nl-desc", { timeout: 8000 });
await page.fill("#nl-desc", "Aluguel");
await page.fill("#nl-valor", "1500,00");
await page.click('button[role="tab"]:has-text("Todo mês")');
await page.click('button:has-text("Salvar lançamento")');
await page.waitForTimeout(1000);

st = await estado();
const semFim = st.series.find((s) => s.kind === "mensal" && !s.ended_ym);
const doAluguel = st.transactions.filter((t) => t.series_id === semFim?.id);
chk("4. fixo sem fim nasce só no mês corrente",
  doAluguel.length === 1 && doAluguel[0].date.startsWith(ym),
  doAluguel.length + " lançamento(s)");

/* ------------- 3. parcelamento nasce com as parcelas futuras ------------- */
await page.click('button:has-text("Adicionar")');
await page.waitForSelector("#nl-desc", { timeout: 8000 });
await page.fill("#nl-desc", "Geladeira");
await page.fill("#nl-valor", "1000,00");
await page.click('button[role="tab"]:has-text("Parcelado")');
await page.waitForSelector("#nl-ate", { timeout: 5000 });
await page.fill("#nl-ate", shift(ym, 9));
await page.click('button:has-text("Salvar lançamento")');
await page.waitForTimeout(1200);

st = await estado();
const parc = st.series.find((s) => s.kind === "parcelado");
const parcelas = st.transactions
  .filter((t) => t.series_id === parc?.id)
  .sort((a, b) => a.date.localeCompare(b.date));
chk("5. as dez parcelas nascem de uma vez",
  parcelas.length === 10 && parcelas.every((p) => p.installment_total === 10),
  parcelas.length + " parcelas");
chk("6. numeradas de 1 a 10, uma por mês",
  parcelas.every((p, i) => p.installment_current === i + 1 && p.date.startsWith(shift(ym, i))),
  parcelas.map((p) => p.date.slice(0, 7) + " " + p.installment_current).join(" "));
chk("7. cada parcela é um décimo do total",
  parcelas.every((p) => Number(p.amount) === 100),
  "1ª = " + (parcelas[0] && parcelas[0].amount));

/* ------------------ 4. o mês futuro na tela, de verdade ----------------- */
await page.goto(APP + "/#/app/lancamentos");
await page.waitForSelector(".mnav", { timeout: 8000 });
await page.click('[aria-label="Próximo mês"]');
await page.waitForTimeout(600);
const textoLista = await page.locator(".scr__body").innerText();
chk("8. o mês que vem mostra o salário e a parcela",
  textoLista.includes("Salário") && textoLista.includes("Geladeira"),
  textoLista.replace(/\s+/g, " ").slice(0, 90));
chk("9. e não mostra o fixo sem fim, que ainda não existe lá",
  !textoLista.includes("Aluguel"), "");

await page.goto(APP + "/#/app/analises");
await page.waitForSelector(".mnav", { timeout: 8000 });
await page.click('[aria-label="Próximo mês"]');
await page.waitForTimeout(600);
const textoAnalise = await page.locator(".scr__body").innerText();
chk("10. análise de mês futuro não dá nota",
  /ainda não chegou/i.test(textoAnalise) && !/Nota parcial/.test(textoAnalise),
  textoAnalise.replace(/\s+/g, " ").slice(0, 110));
chk("11. e mostra o que já está comprometido",
  /comprometido/i.test(textoAnalise) && /4\.000,00/.test(textoAnalise),
  "");

await page.screenshot({ path: "/tmp/serie-futuro.png", fullPage: true });

/* ---------------- 5. reabrir o app não duplica nem repete --------------- */
const antes = (await estado()).transactions.length;
await page.goto(APP + "/#/app");
await page.waitForSelector(".tabbar", { timeout: 15000 });
await page.waitForTimeout(1500);
const depois = (await estado()).transactions.length;
chk("12. reabrir o app não cria nada de novo", antes === depois, antes + " -> " + depois);

await b.close();
const falhas = R.filter((l) => l.startsWith("FALHA"));
console.log("\n" + (R.length - falhas.length) + "/" + R.length + " passaram");
process.exit(falhas.length ? 1 : 0);
