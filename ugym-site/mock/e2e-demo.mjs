/** Conta de exemplo: confere que a carteira de demonstração sobe inteira. */
import { chromium } from "playwright";

const APP = "http://127.0.0.1:" + (process.argv[2] || 5199);
const MOCK = "http://127.0.0.1:" + (process.argv[3] || 54331);
const R = [];
const chk = (n, ok, d = "") => { R.push((ok ? "OK    " : "FALHA ") + n + (d ? "  ->  " + d : "")); console.log(R.at(-1)); };

await fetch(MOCK + "/__zerar", { method: "POST" });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("  [erro na página]", e.message));

await page.goto(APP + "/#/criar-conta");
await page.fill("#au-nome", "Diego");
await page.fill("#au-email", "demo+" + Date.now() + "@teste.dev");
await page.fill("#au-senha", "senha-de-teste-123");
await page.click('button:has-text("Com dados de exemplo")');
await page.click('button:has-text("Criar conta e começar")');
await page.waitForURL(/#\/app/, { timeout: 20000 });
await page.waitForTimeout(2500);

const st = await (await fetch(MOCK + "/__estado")).json();
const uuidOk = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

chk("23. conta de exemplo sobe lançamentos", st.transactions.length > 50, st.transactions.length + " lançamentos");
chk("24. conta de exemplo sobe séries", st.series.length > 0, st.series.length + " séries");
chk("25. todo id de lançamento é UUID válido", st.transactions.every((t) => uuidOk(t.id)), st.transactions.filter((t) => !uuidOk(t.id)).slice(0, 2).map((t) => t.id).join(", ") || "todos válidos");
chk("26. todo id de série é UUID válido", st.series.every((s) => uuidOk(s.id)), st.series.filter((s) => !uuidOk(s.id)).map((s) => s.id).join(", ") || "todos válidos");
const semAviso = (await page.locator(".notice").count()) === 0;
chk("27. nenhuma falha de gravação durante o exemplo", semAviso, semAviso ? "" : await page.locator(".notice span").first().innerText());

await b.close();
const f = R.filter((r) => r.startsWith("FALHA"));
console.log(`\n${R.length - f.length} passaram, ${f.length} falharam.`);
process.exit(f.length ? 1 : 0);
