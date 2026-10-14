/**
 * Testes de cliente, com o aplicativo de verdade rodando no navegador.
 *
 * Sobem o app compilado contra o Supabase de mentira (mock/server.mjs) e
 * conferem o que é responsabilidade nossa: cadastro, sessão que sobrevive
 * ao reload e à troca de rota, criar/editar/excluir lançamento, categoria
 * nova, recorrência mensal, parcelamento, troca de tema, logout, e a
 * reversão otimista com aviso quando a escrita falha.
 *
 *   node mock/e2e.mjs <porta-do-app> <porta-do-mock>
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
const falhar = (on) =>
  fetch(MOCK + "/__falhar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ on }),
  });

await fetch(MOCK + "/__zerar", { method: "POST" });

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("  [erro na página]", e.message));

const mail = "diego+" + Date.now() + "@teste.dev";
const SENHA = "senha-de-teste-123";
const hoje = new Date();
const ym = hoje.getFullYear() + "-" + String(hoje.getMonth() + 1).padStart(2, "0");

/* ------------------------------ 1. cadastro ------------------------------ */
await page.goto(APP + "/#/criar-conta");
await page.fill("#au-nome", "Diego");
await page.fill("#au-email", mail);
await page.fill("#au-senha", SENHA);
await page.click('button[aria-pressed="false"]:has-text("Do zero")').catch(() => {});
await page.click('button:has-text("Criar conta e começar")');
await page.waitForURL(/#\/app/, { timeout: 15000 });
chk("1. cadastro leva para o aplicativo", page.url().includes("#/app"));

const st1 = await estado();
chk("2. perfil criado no banco", st1.profiles.length === 1, "profiles=" + st1.profiles.length);
chk("3. categorias base criadas", st1.categories.length > 5, "categorias=" + st1.categories.length);

/* --------------------- 2. sessão sobrevive ao reload --------------------- */
await page.reload();
await page.waitForSelector(".tabbar", { timeout: 15000 });
chk("4. sessão sobrevive ao recarregar a página", page.url().includes("#/app") && (await page.locator(".tabbar").count()) === 1);

/* ------------------------ 3. navegação entre rotas ----------------------- */
for (const [label] of [["Lançamentos"], ["Resumo"], ["Análises"], ["Início"]]) {
  await page.click(`.tab:has-text("${label}")`);
  await page.waitForTimeout(250);
}
await page.goto(APP + "/#/");
await page.waitForTimeout(400);
await page.goto(APP + "/#/app");
await page.waitForSelector(".tabbar", { timeout: 10000 });
chk("5. continua logado depois de navegar pelo site e voltar", !page.url().includes("entrar"));

/* --------------------------- 4. criar lançamento -------------------------- */
await page.click('.tab:has-text("Lançamentos")');
await page.click('button:has-text("Adicionar")');
await page.fill("#nl-desc", "Padaria");
await page.fill("#nl-valor", "23,50");
await page.click('button:has-text("Salvar lançamento")');
await page.waitForTimeout(700);
let st = await estado();
const criado = st.transactions.find((t) => t.description === "Padaria");
chk("6. criação de lançamento gravada", !!criado && Number(criado.amount) === 23.5, criado ? "amount=" + criado.amount : "não achei");

/* --------------------------- 5. editar lançamento ------------------------- */
await page.click('.row:has-text("Padaria")').catch(async () => {
  await page.click('text=Padaria');
});
await page.waitForSelector("#nl-desc", { timeout: 5000 });
await page.fill("#nl-desc", "Padaria da esquina");
await page.fill("#nl-valor", "27,90");
await page.click('button:has-text("Salvar alterações")');
await page.waitForTimeout(700);
st = await estado();
const editado = st.transactions.find((t) => t.id === criado?.id);
chk("7. edição de lançamento gravada", !!editado && editado.description === "Padaria da esquina" && Number(editado.amount) === 27.9, editado ? editado.description + " / " + editado.amount : "sumiu");

/* -------------------------- 6. categoria nova ---------------------------- */
await page.click('button:has-text("Adicionar")');
await page.click('button:has-text("Nova categoria")');
await page.fill(".inlinecat__name", "Pet");
await page.click('.inlinecat__row button:has-text("Criar")');
await page.waitForTimeout(600);
st = await estado();
chk("8. categoria nova gravada", st.categories.some((c) => c.label === "Pet"), "categorias=" + st.categories.length);

/* ------------------------- 7. recorrência mensal -------------------------- */
await page.fill("#nl-desc", "Plano de saúde");
await page.fill("#nl-valor", "340");
await page.click('button[role="tab"]:has-text("Todo mês")');
await page.click('button:has-text("Salvar lançamento")');
await page.waitForTimeout(800);
st = await estado();
const serieM = st.series.find((s) => s.kind === "mensal");
chk("9. série mensal gravada", !!serieM, serieM ? "start=" + serieM.start_ym : "não criou série");
chk("10. ocorrência do mês criada pela série", st.transactions.some((t) => t.series_id === serieM?.id), "");

/* ----------------------------- 8. parcelamento ---------------------------- */
await page.click('button:has-text("Adicionar")');
await page.fill("#nl-desc", "Notebook");
await page.fill("#nl-valor", "250");
await page.click('button[role="tab"]:has-text("Parcelado")');
/* O número de parcelas virou mês final: a pessoa diz até quando a compra
   vai, e o app conta quantas parcelas são. Dez parcelas são este mês mais
   nove. */
await page.waitForSelector("#nl-ate", { timeout: 5000 });
await page.fill("#nl-ate", ((y, m) => {
  const t = y * 12 + (m - 1) + 9;
  return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0");
})(Number(ym.slice(0, 4)), Number(ym.slice(5, 7))));
await page.click('button:has-text("Salvar lançamento")');
await page.waitForTimeout(900);
st = await estado();
const serieP = st.series.find((s) => s.kind === "parcelado");
const parcelas = st.transactions.filter((t) => t.series_id === serieP?.id);
chk("11. série parcelada gravada", !!serieP && serieP.total === 10, serieP ? "total=" + serieP.total : "não criou");
chk("12. parcelas numeradas", parcelas.length > 0 && parcelas.every((p) => p.installment_total === 10), parcelas.length + " parcelas, 1ª = " + (parcelas[0] && parcelas[0].installment_current) + "/" + (parcelas[0] && parcelas[0].installment_total));

/* ------------------------- 9. exclusão de lançamento ---------------------- */
const antes = (await estado()).transactions.length;
await page.click('[aria-label="Apagar Padaria da esquina"]');
await page.waitForSelector(".confirm", { timeout: 5000 });
const textoConfirma = await page.locator(".confirm__box p").first().innerText();
chk("13. apagar um lançamento pergunta antes", true, textoConfirma.slice(0, 60));

// cancelar não pode apagar nada
await page.click('.confirm__acts .btn--ghost');
await page.waitForTimeout(700);
st = await estado();
chk("14. cancelar mantém o lançamento", st.transactions.length === antes, "antes=" + antes + " depois=" + st.transactions.length);

await page.click('[aria-label="Apagar Padaria da esquina"]');
await page.waitForSelector(".confirm", { timeout: 5000 });
await page.click('.confirm__acts .btn--danger');
await page.waitForTimeout(900);
st = await estado();
chk(
  "15. confirmar apaga o lançamento",
  st.transactions.length === antes - 1 && !st.transactions.some((t) => t.description === "Padaria da esquina"),
  "antes=" + antes + " depois=" + st.transactions.length
);

// apagar todos do mês também pergunta
const antesMes = (await estado()).transactions.length;
await page.click('button:has-text("Apagar todos do mês")');
await page.waitForSelector(".confirm", { timeout: 5000 });
const tituloMes = await page.locator(".confirm__box h2").innerText();
await page.click('.confirm__acts .btn--ghost');
await page.waitForTimeout(600);
st = await estado();
chk("16. apagar todos do mês pergunta e respeita o cancelar", st.transactions.length === antesMes, tituloMes.slice(0, 50));

/* ----------------------------- 10. troca de tema -------------------------- */
await page.click('.tab:has-text("Início")');
await page.waitForTimeout(600);
await page.click('[aria-label="Abrir menu"]');
await page.click('.drawer__row:has-text("Modo escuro")');
await page.waitForTimeout(600);
st = await estado();
const tema1 = st.profiles[0].theme;
await page.click('.drawer__row:has-text("Modo escuro")');
await page.waitForTimeout(600);
st = await estado();
const tema2 = st.profiles[0].theme;
console.log("      (tema no banco: " + tema1 + " depois " + tema2 + ")");
chk("17. troca de tema persiste no banco", tema1 !== tema2 && ["claro", "escuro"].includes(tema2), tema1 + " -> " + tema2);
await page.keyboard.press("Escape");
await page.click(".drawer__scrim").catch(() => {});
await page.waitForTimeout(300);

/* ------------- 11. falha de rede: aviso aparece e estado reverte ---------- */
await falhar(true);
const antesFalha = (await estado()).transactions.length;
await page.click('.tab:has-text("Lançamentos")');
await page.click('button:has-text("Adicionar")');
await page.fill("#nl-desc", "Lançamento que deve sumir");
await page.fill("#nl-valor", "999");
await page.click('button:has-text("Salvar lançamento")');
await page.waitForTimeout(1500);
const aviso = await page.locator(".notice").count();
const avisoTexto = aviso ? await page.locator(".notice span").first().innerText() : "";
chk("18. aviso de falha aparece na tela", aviso === 1, avisoTexto.slice(0, 70));
const naTela = await page.locator('text=Lançamento que deve sumir').count();
chk("19. escrita otimista revertida na tela", naTela === 0, "ainda visível: " + naTela);
st = await estado();
chk("20. nada foi gravado no banco", st.transactions.length === antesFalha, "antes=" + antesFalha + " depois=" + st.transactions.length);
await page.click('[aria-label="Fechar aviso"]').catch(() => {});
await page.waitForTimeout(300);
chk("21. aviso pode ser dispensado", (await page.locator(".notice").count()) === 0);
await falhar(false);

/* --------------------------------- 12. logout ----------------------------- */
await page.click('.tab:has-text("Início")');
await page.waitForTimeout(600);
await page.click('[aria-label="Abrir menu"]');
await page.click('.drawer__row--out');
await page.waitForURL(/#\/(entrar)?$|#\/$/, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(600);
chk("22. logout sai do aplicativo", !page.url().includes("#/app"), page.url().split("#")[1] || "/");
await page.goto(APP + "/#/app");
await page.waitForTimeout(1200);
chk("23. depois do logout, /app manda para o login", page.url().includes("entrar"), page.url().split("#")[1]);

/* ------------------------------ 13. login de volta ------------------------ */
await page.goto(APP + "/#/entrar");
await page.fill("#au-email", mail);
await page.fill("#au-senha", SENHA);
await page.click('button:has-text("Entrar")');
await page.waitForURL(/#\/app/, { timeout: 15000 });
await page.waitForTimeout(1000);
const listou = await page.locator(".tabbar").count();
chk("24. login de volta carrega a conta", listou === 1 && page.url().includes("#/app"));
await page.click('.tab:has-text("Lançamentos")');
await page.waitForTimeout(800);
const temNotebook = await page.locator('text=Notebook').count();
chk("25. dados do usuário voltam depois do login", temNotebook > 0, "linhas Notebook=" + temNotebook);

await b.close();
const falhas = R.filter((r) => r.startsWith("FALHA"));
console.log(`\n${R.length - falhas.length} passaram, ${falhas.length} falharam.`);
process.exit(falhas.length ? 1 : 0);
