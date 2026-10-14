/**
 * Exportação: escolher os meses antes de baixar, e planilha com as
 * colunas já dimensionadas.
 *
 * O download é interceptado e o .xlsx é aberto aqui mesmo para conferir
 * o conteúdo e as larguras, em vez de confiar que o arquivo saiu certo.
 *
 *   node mock/e2e-exportar.mjs <porta-do-app> <porta-do-mock>
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { crc32 } from "node:zlib";

const APP = "http://127.0.0.1:" + (process.argv[2] || 5199);
const MOCK = "http://127.0.0.1:" + (process.argv[3] || 54331);
const R = [];
const chk = (n, ok, d = "") => {
  R.push((ok ? "OK    " : "FALHA ") + n + (d ? "  ->  " + d : ""));
  console.log(R.at(-1));
};

await fetch(MOCK + "/__zerar", { method: "POST" });

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  [erro na página]", e.message));

/* ---------- conta vazia: não pode exportar ---------- */
const vazio = "exp-vazio-" + Date.now() + "@teste.dev";
await page.goto(APP + "/#/criar-conta");
await page.waitForSelector("#au-nome", { timeout: 15000 });
await page.fill("#au-nome", "Vazio");
await page.fill("#au-email", vazio);
await page.fill("#au-senha", "senha-de-teste-123");
await page.click('button:has-text("Do zero")');
await page.click('button:has-text("Criar conta e começar")');
await page.waitForURL(/#\/app/, { timeout: 20000 });
await page.goto(APP + "/#/app/lancamentos");
await page.waitForTimeout(1500);

/* Importar e exportar moram no mesmo botão; a escolha abre num menu. */
await page.click('[aria-label="Importar ou exportar"]');
await page.waitForSelector(".arqmenu", { timeout: 6000 });
const semDados = await page.evaluate(() => {
  const btn = [...document.querySelectorAll(".arqmenu__i")].find((b) =>
    /Exportar/.test(b.textContent)
  );
  return { existe: Boolean(btn), desligado: btn ? btn.disabled : null, titulo: btn?.title };
});
chk("1. sem lançamento nenhum, exportar fica travado", semDados.desligado === true, semDados.titulo);

await page.click('.arqmenu__i:has-text("Exportar planilha")', { force: true }).catch(() => {});
await page.waitForTimeout(600);
chk("2. clicar mesmo assim não abre nada", (await page.locator(".exp__lista").count()) === 0);
await page.click(".menu__catch").catch(() => {});
await page.waitForTimeout(300);

/* ---------- conta com dados: escolhe meses e baixa ---------- */
await page.click('[aria-label="Abrir menu"]').catch(async () => {
  await page.goto(APP + "/#/app");
  await page.waitForTimeout(800);
  await page.click('[aria-label="Abrir menu"]');
});
await page.waitForSelector(".drawer", { timeout: 6000 });
await page.click(".drawer__row--out");
await page.waitForTimeout(1200);

const cheio = "exp-cheio-" + Date.now() + "@teste.dev";
await page.goto(APP + "/#/criar-conta");
await page.waitForSelector("#au-nome", { timeout: 15000 });
await page.fill("#au-nome", "Diego");
await page.fill("#au-email", cheio);
await page.fill("#au-senha", "senha-de-teste-123");
await page.click('button:has-text("Com dados de exemplo")');
await page.click('button:has-text("Criar conta e começar")');
await page.waitForURL(/#\/app/, { timeout: 20000 });
await page.waitForTimeout(2800);
await page.goto(APP + "/#/app/lancamentos");
await page.waitForTimeout(1500);

await page.click('[aria-label="Importar ou exportar"]');
await page.waitForSelector(".arqmenu", { timeout: 6000 });
const comDados = await page.evaluate(
  () =>
    [...document.querySelectorAll(".arqmenu__i")].find((b) => /Exportar/.test(b.textContent))
      .disabled
);
chk("3. com lançamentos, exportar fica disponível", comDados === false);

await page.click('.arqmenu__i:has-text("Exportar planilha")');
await page.waitForSelector(".exp__lista", { timeout: 8000 });
chk("4. abre a escolha de meses antes de baixar", true);

const meses = await page.locator(".exp__mes").count();
chk("5. lista os meses que têm dados", meses >= 4, meses + " meses");

const marcadosInicio = await page.locator('.exp__mes[aria-pressed="true"]').count();
chk("6. já vem com o mês aberto marcado", marcadosInicio === 1, marcadosInicio + " marcado(s)");

/* desmarcar tudo trava o botão */
await page.click('button:has-text("Marcar todos")');
await page.waitForTimeout(300);
await page.click('button:has-text("Limpar")');
await page.waitForTimeout(300);
const travado = await page.evaluate(
  () => document.querySelector(".sheet__panel .btn--pos").disabled
);
chk("7. sem nenhum mês marcado, baixar fica travado", travado === true);

/* marca dois meses e confere a contagem */
await page.locator(".exp__mes").nth(0).click();
await page.locator(".exp__mes").nth(1).click();
await page.waitForTimeout(400);
const resumo = await page.evaluate(() => {
  const v = document.querySelectorAll(".duo__v");
  return { linhas: Number(v[0].textContent), rotulo: document.querySelector(".sheet__panel .btn--pos").innerText };
});
chk("8. o resumo conta as linhas dos meses marcados", resumo.linhas > 0, resumo.linhas + " linhas");
chk("9. o botão diz quantos meses vão", /2 meses/.test(resumo.rotulo), resumo.rotulo.trim());

/* ---------- o arquivo em si ---------- */
const [download] = await Promise.all([
  page.waitForEvent("download", { timeout: 30000 }),
  page.click(".sheet__panel .btn--pos"),
]);
const nome = download.suggestedFilename();
chk("10. baixa um arquivo com nome dos dois meses", /^gasto-\d{4}-\d{2}-a-\d{4}-\d{2}\.(xlsx|csv)$/.test(nome), nome);

const caminho = await download.path();
const bytes = readFileSync(caminho);
const ehXlsx = bytes[0] === 0x50 && bytes[1] === 0x4b; // assinatura de zip
chk("11. o arquivo é uma planilha de verdade", ehXlsx, ehXlsx ? "xlsx" : "caiu no csv de emergência");

if (ehXlsx) {
  /* abre o .xlsx dentro do próprio navegador, com a mesma biblioteca */
  const base64 = bytes.toString("base64");
  const conferido = await page.evaluate(async (b64) => {
    const bin = atob(b64);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const XLSX = await import("/assets/xlsx.js");
    // cellStyles traz a largura das colunas de volta, cellNF traz o formato
    const wb = XLSX.read(buf, { type: "array", cellStyles: true, cellNF: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const cols = ws["!cols"] || [];
    // maior texto de cada coluna, para comparar com a largura declarada
    const maiores = linhas[0].map((_, c) =>
      linhas.reduce((m, l) => Math.max(m, String(l[c] ?? "").length), 0)
    );
    return {
      aba: wb.SheetNames[0],
      cabecalho: linhas[0],
      total: linhas.length - 1,
      larguras: cols.map((c) => c && c.wch),
      maiores,
      valorEhNumero: typeof linhas[1][6] === "number",
      formatoMoeda: (ws[XLSX.utils.encode_cell({ r: 1, c: 6 })] || {}).z || "",
    };
  }, base64);

  chk("12. a aba tem nome", conferido.aba === "Lançamentos", conferido.aba);
  chk("13. o cabeçalho está completo", conferido.cabecalho.length === 7, conferido.cabecalho.join(", "));
  chk("14. o número de linhas bate com a prévia", conferido.total === resumo.linhas,
    conferido.total + " no arquivo, " + resumo.linhas + " na prévia");
  chk("15. toda coluna tem largura definida",
    conferido.larguras.length === 7 && conferido.larguras.every((w) => w > 0),
    conferido.larguras.join(" | "));
  chk("16. a largura cabe o conteúdo de cada coluna",
    conferido.larguras.every((w, i) => w >= Math.min(52, conferido.maiores[i] + 2)),
    conferido.larguras.map((w, i) => `${w}>=${conferido.maiores[i] + 2}`).join(" "));
  chk("17. nenhuma coluna fica larga demais", conferido.larguras.every((w) => w <= 52),
    "maior: " + Math.max(...conferido.larguras));
  // o painel congelado é escrito direto no XML da aba, que fica visível
  // dentro do arquivo porque a planilha sai sem compressão
  const xml = bytes.toString("latin1");
  chk("18. cabeçalho congelado", /state="frozen"/.test(xml) && /ySplit="1"/.test(xml));
  chk("19. valor sai como número, não texto", conferido.valorEhNumero);
  chk("20. valor com formato de moeda", /R\$/.test(conferido.formatoMoeda), conferido.formatoMoeda);

  /* o arquivo é remontado à mão para congelar o cabeçalho, então vale
     conferir entrada por entrada se o pacote continua íntegro */
  const inteiro = (() => {
    let fim = -1;
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (bytes.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
    }
    if (fim < 0) return "não achei o fim do índice";
    const quantas = bytes.readUInt16LE(fim + 10);
    let p = bytes.readUInt32LE(fim + 16);
    for (let n = 0; n < quantas; n++) {
      if (bytes.readUInt32LE(p) !== 0x02014b50) return "índice quebrado na entrada " + n;
      const crc = bytes.readUInt32LE(p + 16);
      const tam = bytes.readUInt32LE(p + 20);
      const nomeLen = bytes.readUInt16LE(p + 28);
      const nome = bytes.toString("utf8", p + 46, p + 46 + nomeLen);
      const local = bytes.readUInt32LE(p + 42);
      if (bytes.readUInt32LE(local) !== 0x04034b50) return "cabeçalho local quebrado: " + nome;
      const inicio = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
      const real = crc32(bytes.subarray(inicio, inicio + tam));
      if (real !== crc) return "conferência falhou em " + nome;
      p += 46 + nomeLen + bytes.readUInt16LE(p + 30) + bytes.readUInt16LE(p + 32);
    }
    return quantas + " arquivos conferidos";
  })();
  chk("21. o pacote continua íntegro depois de remontado", /conferidos/.test(inteiro), inteiro);
}

await b.close();
const f = R.filter((x) => x.startsWith("FALHA"));
console.log(`\n${R.length - f.length} passaram, ${f.length} falharam.`);
process.exit(f.length ? 1 : 0);
