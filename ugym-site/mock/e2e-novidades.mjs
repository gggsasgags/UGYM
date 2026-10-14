/**
 * Testes do que entrou nesta rodada.
 *
 *  - cadastro com confirmação de e-mail ligada leva para o login com aviso
 *  - a escolha de dados de exemplo sobrevive à confirmação
 *  - a tela de colunas aparece na importação, deixa trocar e descartar coluna
 *
 *   node mock/e2e-novidades.mjs <porta-do-app> <porta-do-mock>
 */
import { chromium } from "playwright";

const APP = "http://127.0.0.1:" + (process.argv[2] || 5212);
const MOCK = "http://127.0.0.1:" + (process.argv[3] || 54331);
const R = [];
const chk = (n, ok, d = "") => {
  R.push((ok ? "OK    " : "FALHA ") + n + (d ? "  ->  " + d : ""));
  console.log(R.at(-1));
};
const estado = async () => (await fetch(MOCK + "/__estado")).json();
const post = (rota, corpo) =>
  fetch(MOCK + rota, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });

await post("/__zerar", {});
await post("/__confirmar", { on: true });

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("  [erro na página]", e.message));

const mail = "confirma+" + Date.now() + "@teste.dev";
const SENHA = "senha-de-teste-123";

/* ---------- 1. cadastro com confirmação de e-mail ligada ---------- */
await page.goto(APP + "/#/criar-conta");
await page.fill("#au-nome", "Fulano");
await page.fill("#au-email", mail);
await page.fill("#au-senha", SENHA);
await page.click('button:has-text("Com dados de exemplo")');
await page.click('button:has-text("Criar conta e começar")');
await page.waitForTimeout(1500);

chk("1. cadastro sem sessão não entra no app", !page.url().includes("#/app"), page.url().split("#")[1]);
chk("2. leva para a tela de entrar", page.url().includes("#/entrar"), page.url().split("#")[1]);
const aviso = await page.locator(".auth__aviso").count();
const textoAviso = aviso ? await page.locator(".auth__aviso strong").innerText() : "";
chk("3. mostra o aviso de confirmação", aviso === 1, textoAviso);
const emailPreenchido = await page.inputValue("#au-email");
chk("4. e-mail já vem preenchido no login", emailPreenchido === mail, emailPreenchido);
const temSenha = await page.locator("#au-senha").count();
chk("5. é mesmo o formulário de e-mail e senha", temSenha === 1);
const st0 = await estado();
chk("6. nada foi gravado antes da confirmação", st0.profiles.length === 0 && st0.transactions.length === 0,
  "perfis=" + st0.profiles.length + " lançamentos=" + st0.transactions.length);

const reenviar = page.locator('.auth__aviso button:has-text("Reenviar")');
await reenviar.click();
await page.waitForTimeout(700);
const ok = await page.locator(".auth__aviso__ok").count();
chk("7. reenviar o e-mail responde na tela", ok === 1);

/* ---------- 2. depois de confirmar, o exemplo sobe no primeiro login ---------- */
await post("/__confirmar", { on: false }); // simula o clique no link
await page.fill("#au-email", mail);
await page.fill("#au-senha", SENHA);
await page.click('button:has-text("Entrar")');
await page.waitForURL(/#\/app/, { timeout: 15000 });
await page.waitForTimeout(2500);
const st1 = await estado();
chk("8. login entra no app depois de confirmado", page.url().includes("#/app"));
chk("9. dados de exemplo sobem no primeiro login", st1.transactions.length > 50, st1.transactions.length + " lançamentos");
chk("10. nome escolhido no cadastro é preservado", st1.profiles[0]?.name === "Fulano", st1.profiles[0]?.name);

/* ---------- 3. tela de colunas na importação ---------- */
const csv = [
  "Data;Histórico;Documento;Valor;Classificação",
  "03/09/2026;SUPERMERCADO CENTRAL;000123;-184,50;Mercado",
  "05/09/2026;SALARIO EMPRESA;000124;3850,00;Salário",
  "09/09/2026;POSTO COMBUSTIVEL;000125;-212,30;Transporte",
  "14/09/2026;FARMACIA POPULAR;000126;-64,90;Saúde",
].join("\n");

await page.click('.tab:has-text("Lançamentos")');
await page.waitForTimeout(400);
const input = page.locator('input[type="file"]').first();
await input.setInputFiles({ name: "extrato.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
await page.waitForSelector(".colmap__chips", { timeout: 10000 });
chk("11. importar abre a tela de colunas", true);

const chips = await page.locator(".colmap__chip").allInnerTexts();
chk("12. lista as colunas do arquivo", chips.length === 5, chips.join(" | "));

const linhasPrevia = await page.locator(".colmap__previa .preview__row").count();
chk("13. prévia mostra as linhas lidas", linhasPrevia === 4, linhasPrevia + " linhas");

// a coluna de categoria do arquivo deve ter sido detectada como "Classificação"
const previaAntes = await page.locator(".colmap__previa .preview__d").first().innerText();
chk("14. descrição vem da coluna certa", /supermercado/i.test(previaAntes), previaAntes);

// descartar a coluna Documento não pode mudar nada
await page.click('.colmap__chip:has-text("Documento")');
await page.waitForTimeout(400);
const depoisDescarte = await page.locator(".colmap__previa .preview__row").count();
chk("15. descartar coluna inútil não quebra a leitura", depoisDescarte === 4, depoisDescarte + " linhas");

// trocar a descrição para a coluna errada muda a prévia na hora
const seletores = page.locator(".colmap__campos select");
await seletores.nth(1).selectOption({ label: "Classificação" });
await page.waitForTimeout(400);
const trocado = await page.locator(".colmap__previa .preview__d").first().innerText();
chk("16. trocar a coluna muda a prévia na hora", /mercado/i.test(trocado) && !/supermercado/i.test(trocado), trocado);

// volta ao certo e importa
await seletores.nth(1).selectOption({ label: "Histórico" });
await page.waitForTimeout(400);
await page.click('button:has-text("Continuar com")');
await page.waitForSelector('button:has-text("Importar")', { timeout: 8000 });
await page.click('button:has-text("Importar")');
await page.waitForTimeout(1500);

const st2 = await estado();
/* A conta já tem a carteira de exemplo, então a checagem olha só para as
   descrições que vieram do arquivo, que são inconfundíveis. */
const doArquivo = ["Supermercado Central", "Salario Empresa", "Posto Combustivel", "Farmacia Popular"];
const importados = st2.transactions.filter((t) => doArquivo.includes(t.description));
chk("17. lançamentos do extrato entraram", importados.length === 4,
  importados.length + " de 4: " + importados.map((t) => t.description).join(", "));
const receita = importados.find((t) => t.description === "Salario Empresa");
chk("18. valor positivo virou receita", receita?.kind === "receita" && Number(receita.amount) === 3850,
  receita?.kind + " " + receita?.amount);
const despesa = importados.find((t) => t.description === "Supermercado Central");
chk("19. valor negativo virou despesa", despesa?.kind === "despesa" && Number(despesa.amount) === 184.5,
  despesa?.kind + " " + despesa?.amount);
const cats = st2.categories.map((c) => c.label);
chk("20. categoria veio da coluna do arquivo", cats.includes("Mercado") && cats.includes("Saúde"),
  cats.filter((c) => ["Mercado", "Saúde", "Transporte", "Salário"].includes(c)).join(", "));

await b.close();
const f = R.filter((x) => x.startsWith("FALHA"));
console.log(`\n${R.length - f.length} passaram, ${f.length} falharam.`);
process.exit(f.length ? 1 : 0);
