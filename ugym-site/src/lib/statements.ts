import { guessCategory, slugify } from "./categories";
import type { Category, Transaction } from "./types";

/* ------------------------------------------------------------------
   Leitura de extratos bancários.
   Aceita CSV, XLS, XLSX e PDF. As bibliotecas pesadas (SheetJS e
   pdf.js) só são baixadas quando o usuário importa um arquivo desse
   tipo, então nada disso entra no carregamento normal do app.
-------------------------------------------------------------------*/

export interface ImportResult {
  rows: Omit<Transaction, "id">[];
  /** descrição como veio do banco, na mesma ordem de `rows`; a triagem
      precisa dela porque a limpeza tira palavras que ajudam a decidir */
  brutos?: string[];
  newCategories: Category[];
  skipped: number;
  source: string;
  /** linhas que o app já tinha e por isso não serão importadas de novo */
  duplicates?: number;
  error?: string;
  /** presente em CSV e planilha: deixa o usuário conferir e trocar as colunas */
  table?: Tabela;
}

/** Qual coluna do arquivo é o quê. -1 significa "não tem" ou "descartada". */
export interface Mapa {
  data: number;
  descricao: number;
  /** coluna única de valor, com sinal */
  valor: number;
  /** ou duas colunas separadas, como muitos bancos exportam */
  credito: number;
  debito: number;
  /** -1 deixa o Gastô adivinhar pela descrição */
  categoria: number;
  /** colunas que o usuário mandou ignorar */
  ignoradas: number[];
}

export interface Tabela {
  /** nomes do cabeçalho, já na ordem original do arquivo */
  cabecalho: string[];
  /** linhas de dados, sem o cabeçalho */
  linhas: string[][];
  /** o que o Gastô detectou sozinho; é o ponto de partida da tela */
  mapa: Mapa;
}

/** Identidade de um lançamento para efeito de importação repetida. */
const fingerprint = (t: { date: string; kind: string; amount: number; description: string }) =>
  `${t.date}|${t.kind}|${t.amount.toFixed(2)}|${t.description.toLowerCase()}`;

/**
 * Tira do resultado as linhas que já existem no app, contando repetições:
 * se o mês já tem um "Uber 12,00" e o extrato traz dois, um entra.
 * É o que evita duplicar tudo quando o usuário importa o mesmo período.
 */
export function withoutKnown(
  result: ImportResult,
  existing: { date: string; kind: string; amount: number; description: string }[]
): ImportResult {
  if (result.error || !result.rows.length) return result;

  const budget = new Map<string, number>();
  for (const t of existing) {
    const k = fingerprint(t);
    budget.set(k, (budget.get(k) ?? 0) + 1);
  }
  /* O filtro guarda o índice porque a descrição crua vive num array
     paralelo: tirar uma linha sem tirar o cru dela desalinharia os dois
     e a triagem passaria a ler a descrição da linha errada. */
  const manter: number[] = [];
  result.rows.forEach((r, i) => {
    const k = fingerprint(r);
    const left = budget.get(k) ?? 0;
    if (left > 0) {
      budget.set(k, left - 1);
      return;
    }
    manter.push(i);
  });
  const rows = manter.map((i) => result.rows[i]);
  const brutos = result.brutos ? manter.map((i) => result.brutos![i]) : undefined;
  const kept = new Set(rows.map((r) => r.category));
  return {
    ...result,
    rows,
    brutos,
    newCategories: result.newCategories.filter((c) => kept.has(c.id)),
    duplicates: result.rows.length - rows.length,
  };
}

/* ----------------------------- utilidades ----------------------------- */

const norm = (s: string) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const parseDate = (raw: string): string | null => {
  const s = String(raw ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
};

const parseAmount = (raw: string): number => {
  let s = String(raw ?? "").replace(/\s/g, "");
  if (!s) return NaN;
  const negative = /^\(.*\)$/.test(s) || s.includes("-") || /\bD$/i.test(s);
  s = s.replace(/[^\d,.]/g, "");
  if (!s) return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const v = Number(s);
  if (!Number.isFinite(v)) return NaN;
  return negative ? -Math.abs(v) : v;
};

/** Deixa a descrição do banco legível sem perder o que importa. */
export function cleanDescription(raw: string) {
  let s = String(raw ?? "").replace(/\s+/g, " ").trim();

  s = s.replace(/^DEBITO VISA ELECTRON BRASIL\s*\d{0,2}\/?\d{0,2}\s*/i, "");
  s = s.replace(/^COMPRA CARTAO(\s+DE)?\s+DEBITO\s*\d{0,2}\/?\d{0,2}\s*/i, "");
  s = s.replace(/^PAGAMENTO CARTAO CREDITO.*$/i, "Fatura do cartão");
  s = s.replace(/^REMUNERACAO APLICACAO AUTOMATICA.*$/i, "Rendimento da aplicação");
  s = s.replace(/^APLICACAO AUTOMATICA.*$/i, "Aplicação automática");
  s = s.replace(/^(PIX (ENVIADO|RECEBIDO))\s*$/i, (_x, a: string) =>
    /ENVIADO/i.test(a) ? "Pix enviado" : "Pix recebido"
  );
  s = s.replace(/^PIX ENVIADO\s+/i, "");
  s = s.replace(/^PIX RECEBIDO\s+/i, "");
  s = s.replace(/^TED\s+(RECEBIDA|ENVIADA)\s*/i, "");
  s = s.replace(/\s*\d{2}\/\d{2}\s+\d{2}:\d{2}\s*/g, " ");
  s = s.replace(/\s+/g, " ").trim();

  if (!s) return "Lançamento importado";
  // Caixa alta inteira fica agressiva na lista; converte para capitular.
  if (s === s.toUpperCase()) {
    s = s
      .toLowerCase()
      .split(" ")
      .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }
  return s.slice(0, 64);
}

interface Raw {
  date: string;
  description: string;
  amount: number;
  /** categoria escrita no próprio extrato, quando o usuário apontou a coluna */
  category?: string;
}

/** Converte linhas cruas em lançamentos, adivinhando a categoria. */
function build(raws: Raw[], cats: Category[], source: string, skipped: number): ImportResult {
  const known = new Map(cats.map((c) => [c.id, c]));
  const newCategories: Category[] = [];
  const rows: Omit<Transaction, "id">[] = [];
  const brutos: string[] = [];

  for (const r of raws) {
    const kind: Transaction["kind"] = r.amount < 0 ? "despesa" : "receita";
    const description = cleanDescription(r.description);
    /* Categoria do próprio arquivo ganha da adivinhação: se o usuário
       apontou a coluna, é porque confia mais nela do que no palpite. */
    const doArquivo = r.category?.trim() ? slugify(r.category.trim()) : "";
    /* O id é calculado uma vez só e é o mesmo no lançamento e na
       categoria nova. Antes o lançamento guardava `category` e a
       categoria nascia com `slugify(category)`: um nome comprido podia
       ser cortado de um jeito na primeira passada e de outro na
       segunda, e então o lançamento apontava para uma categoria que
       nunca foi criada. Na tela, cada um desses órfãos virava mais uma
       linha chamada "Outros". */
    const category = doArquivo || guessCategory(`${r.description} ${description}`, kind);
    if (!known.has(category) && !newCategories.some((c) => c.id === category)) {
      const rotulo = (doArquivo ? r.category!.trim() : category).replace(/\s+/g, " ");
      newCategories.push({
        id: category,
        label: rotulo[0].toUpperCase() + rotulo.slice(1),
        emoji: "🏷️",
        kind,
      });
    }
    rows.push({
      description,
      amount: Math.abs(r.amount),
      kind,
      category,
      date: r.date,
      recurrence: "variavel",
    });
    brutos.push(String(r.description ?? ""));
  }

  return { rows, brutos, newCategories, skipped, source };
}

/* ------------------------------- tabelas ------------------------------- */

/** Lê uma matriz de células, venha ela de CSV ou de planilha. */
function fromTable(table: string[][], cats: Category[], source: string): ImportResult {
  const find = (row: string[], ...names: string[]) =>
    row.findIndex((h) => names.some((n) => norm(h).includes(n)));

  let head = -1;
  const mapa: Mapa = {
    data: -1,
    descricao: -1,
    valor: -1,
    credito: -1,
    debito: -1,
    categoria: -1,
    ignoradas: [],
  };

  for (let r = 0; r < Math.min(table.length, 40); r++) {
    const row = table[r];
    const d = find(row, "data", "date");
    if (d < 0) continue;
    const cred = find(row, "credito", "credit", "entrada");
    const deb = find(row, "debito", "debit", "saida");
    const val = find(row, "valor", "amount", "montante");
    if (cred >= 0 || deb >= 0 || val >= 0) {
      head = r;
      mapa.data = d;
      mapa.descricao = find(row, "descricao", "historico", "lancamento", "memo", "detalhe");
      mapa.credito = cred;
      mapa.debito = deb;
      mapa.valor = val;
      mapa.categoria = find(row, "categoria", "category", "classificacao");
      break;
    }
  }

  if (head < 0) {
    /* Sem cabeçalho reconhecível o Gastô não chuta, mas também não desiste:
       devolve a tabela crua para o usuário apontar as colunas na mão. */
    const primeira = table.find((r) => r.some((c) => String(c).trim())) ?? [];
    return {
      rows: [],
      newCategories: [],
      skipped: 0,
      source,
      error: "Não reconhecemos as colunas deste arquivo. Aponte você mesmo qual é cada uma.",
      table: {
        cabecalho: primeira.map((c, i) => String(c ?? "").trim() || `Coluna ${i + 1}`),
        linhas: table.slice(1).filter((r) => r.some((c) => String(c ?? "").trim())),
        mapa,
      },
    };
  }

  const tabela: Tabela = {
    cabecalho: table[head].map((c, i) => String(c ?? "").trim() || `Coluna ${i + 1}`),
    linhas: table.slice(head + 1).filter((r) => r.some((c) => String(c ?? "").trim())),
    mapa,
  };

  return { ...aplicarMapa(tabela, mapa, cats, source), table: tabela };
}

/**
 * Monta os lançamentos a partir de um mapeamento de colunas.
 *
 * É a mesma função que roda na detecção automática e quando o usuário
 * troca as colunas na tela, então o que ele vê na prévia é exatamente o
 * que vai ser importado.
 */
export function aplicarMapa(
  tabela: Tabela,
  mapa: Mapa,
  cats: Category[],
  source: string
): ImportResult {
  const raws: Raw[] = [];
  let skipped = 0;

  const celula = (row: string[], i: number) =>
    i >= 0 && !mapa.ignoradas.includes(i) ? String(row[i] ?? "") : "";

  for (const row of tabela.linhas) {
    const date = parseDate(celula(row, mapa.data));
    if (!date) {
      skipped++;
      continue;
    }
    let amount = NaN;
    if (mapa.credito >= 0 || mapa.debito >= 0) {
      const c = parseAmount(celula(row, mapa.credito));
      const d = parseAmount(celula(row, mapa.debito));
      if (Number.isFinite(c) && c !== 0) amount = Math.abs(c);
      else if (Number.isFinite(d) && d !== 0) amount = -Math.abs(d);
    } else {
      amount = parseAmount(celula(row, mapa.valor));
    }
    if (!Number.isFinite(amount) || amount === 0) {
      skipped++;
      continue;
    }
    raws.push({
      date,
      description: celula(row, mapa.descricao),
      amount,
      category: celula(row, mapa.categoria) || undefined,
    });
  }

  if (!raws.length) {
    return {
      rows: [],
      newCategories: [],
      skipped,
      source,
      error:
        "Nenhuma linha pôde ser lida com essas colunas. Confira qual é a data e qual é o valor.",
    };
  }
  return build(raws, cats, source, skipped);
}

/* --------------------------------- CSV --------------------------------- */

const splitLine = (line: string, sep: string) => {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
};

function fromCSV(text: string, cats: Category[]): ImportResult {
  const clean = text.replace(/^﻿/, "").replace(/\r/g, "");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return {
      rows: [],
      newCategories: [],
      skipped: 0,
      source: "CSV",
      error: "O arquivo não tem linhas suficientes.",
    };
  }
  const probe = lines.slice(0, 8).join("\n");
  const sep =
    (probe.match(/;/g) ?? []).length >= (probe.match(/,/g) ?? []).length
      ? ";"
      : (probe.match(/\t/g) ?? []).length > 4
      ? "\t"
      : ",";
  return fromTable(
    lines.map((l) => splitLine(l, sep)),
    cats,
    "CSV"
  );
}

/* ------------------------------ planilhas ------------------------------ */

/**
 * Deixa a biblioteca de planilha pronta e a devolve.
 *
 * Vem do próprio domínio, empacotada com o aplicativo, e não de um CDN:
 * assim ninguém consegue trocar o código no meio do caminho, e ler ou
 * gerar planilha continua funcionando mesmo com a rede capenga. O
 * import é dinâmico, então o peso dela só é baixado por quem importa ou
 * exporta de verdade.
 */
export async function carregarSheetJS() {
  return import("xlsx");
}

async function fromSheet(file: File, cats: Category[]): Promise<ImportResult> {
  const XLSX = await carregarSheetJS();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: false, raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const table: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });
  return fromTable(
    table.map((r) => r.map((c) => String(c ?? ""))),
    cats,
    "planilha"
  );
}

/* --------------------------------- PDF --------------------------------- */

/** `31/08/2026 DESCRIÇÃO 000000 -42,00 0,27` */
const PDF_LINE =
  /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]*\d,\d{2})\s+(-?[\d.]*\d,\d{2})\s*$/;

/**
 * Carrega o pdf.js e aponta o worker, uma vez só.
 *
 * Vem do próprio domínio, empacotado pelo Vite, e não de um CDN: some a
 * dependência de rede no meio de uma importação e some a possibilidade de
 * um terceiro entregar outro arquivo no lugar.
 *
 * Os dois `import()` são dinâmicos para o peso do pdf.js só descer para
 * quem importa PDF de verdade. O `?url` não traz o worker para dentro do
 * pacote: ele devolve só o endereço do arquivo que o Vite publicou, que é
 * o que o pdf.js precisa para abrir o worker numa thread separada.
 */
async function carregarPDFjs() {
  const [lib, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
}

async function fromPDF(file: File, cats: Category[]): Promise<ImportResult> {
  const lib = await carregarPDFjs();

  const buf = await file.arrayBuffer();
  /* `isEvalSupported: false` desliga a avaliação dinâmica dentro do pdf.js.
     A versão empacotada aqui já corrigiu a CVE-2024-4367, mas a opção fica:
     ela fecha a mesma classe de problema por construção, e não custa nada.
     `disableAutoFetch` e `disableRange` continuam válidos na 4.x e evitam
     que a biblioteca tente buscar pedaços do arquivo pela rede, coisa que
     não faz sentido para um PDF que já veio inteiro do disco. */
  const doc = await lib.getDocument({
    data: buf,
    isEvalSupported: false,
    disableAutoFetch: true,
    disableRange: true,
  }).promise;

  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    /* Agrupa os fragmentos por linha usando a coordenada vertical. Bancos
       costumam desenhar os valores alguns pontos acima da descrição, então
       não dá para arredondar: a linha é um agrupamento por proximidade. */
    const items = (content.items as { str: string; transform: number[] }[])
      .filter((i) => i.str.trim())
      .map((i) => ({ y: i.transform[5], x: i.transform[4], str: i.str }))
      .sort((a, b) => b.y - a.y);

    const TOL = 5; // pontos de folga entre o topo e a base da mesma linha
    const rows: { y: number; parts: { x: number; str: string }[] }[] = [];
    for (const it of items) {
      const row = rows[rows.length - 1];
      if (row && Math.abs(row.y - it.y) <= TOL) row.parts.push(it);
      else rows.push({ y: it.y, parts: [it] });
    }

    for (const row of rows) {
      lines.push(
        row.parts
          .sort((a, b) => a.x - b.x)
          .map((t) => t.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      );
    }
  }

  const raws: Raw[] = [];
  let skipped = 0;
  for (const line of lines) {
    const m = line.match(PDF_LINE);
    if (!m) {
      if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) skipped++;
      continue;
    }
    const date = parseDate(m[1]);
    const amount = parseAmount(m[3]);
    if (!date || !Number.isFinite(amount) || amount === 0) {
      skipped++;
      continue;
    }
    // o número do documento fica grudado no fim da descrição
    // o número do documento vem logo depois da descrição, às vezes colado nela
    const description = m[2].replace(/\s*\d{6}$/, "").trim();
    raws.push({ date, description, amount });
  }

  if (!raws.length) {
    return {
      rows: [],
      newCategories: [],
      skipped,
      source: "PDF",
      error:
        "Não reconhecemos as linhas deste PDF. Ele precisa ser o extrato original do banco, não uma foto ou digitalização.",
    };
  }
  return build(raws, cats, "PDF", skipped);
}

/* ------------------------------- entrada ------------------------------- */

/** teto de tamanho: extrato de banco não passa disso, e arquivo enorme trava a aba */
const LIMITE_MB = 20;

/**
 * Descobre o formato pelos primeiros bytes, não pelo nome.
 *
 * A extensão é escolha de quem mandou o arquivo. Um PDF renomeado para
 * .xlsx iria parar no leitor de planilha, que não foi feito para isso.
 */
async function formatoReal(file: File): Promise<"pdf" | "planilha" | "texto"> {
  const cabeca = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const assinatura = (...b: number[]) => b.every((v, i) => cabeca[i] === v);
  if (assinatura(0x25, 0x50, 0x44, 0x46)) return "pdf"; // %PDF
  if (assinatura(0x50, 0x4b, 0x03, 0x04)) return "planilha"; // zip: xlsx
  if (assinatura(0xd0, 0xcf, 0x11, 0xe0)) return "planilha"; // xls antigo
  return "texto";
}

export async function parseStatement(file: File, cats: Category[]): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  try {
    if (file.size > LIMITE_MB * 1024 * 1024) {
      return {
        rows: [],
        newCategories: [],
        skipped: 0,
        source: name.split(".").pop() ?? "arquivo",
        error: `O arquivo tem mais de ${LIMITE_MB} MB. Extrato de banco costuma ser bem menor; confira se é o arquivo certo.`,
      };
    }

    const formato = await formatoReal(file);
    if (formato === "pdf") return await fromPDF(file, cats);
    if (formato === "planilha") return await fromSheet(file, cats);
    const text = await file.text();
    return fromCSV(text, cats);
  } catch (e) {
    return {
      rows: [],
      newCategories: [],
      skipped: 0,
      source: name.split(".").pop() ?? "arquivo",
      error:
        e instanceof Error
          ? e.message
          : "Não conseguimos ler este arquivo. Tente exportar o extrato em CSV.",
    };
  }
}
