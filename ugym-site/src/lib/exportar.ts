import { findCategory } from "./categories";
import { monthLabel } from "./format";
import { carregarSheetJS } from "./statements";
import { trocarNoZip } from "./zip";
import type { Category, Transaction } from "./types";

/* ------------------------------------------------------------------
   Exportar a carteira.

   Sai em .xlsx e não em CSV por um motivo prático: CSV não guarda
   largura de coluna, então o usuário abria a planilha e tinha que
   arrastar cada divisória para conseguir ler a descrição. Aqui a
   largura é medida a partir do conteúdo de verdade, o cabeçalho vem
   congelado, e o valor vai como número com formato de moeda, então dá
   para somar e filtrar sem tratar nada antes.

   O CSV continua disponível como plano B: se a biblioteca não baixar,
   ninguém fica sem o próprio dado.
-------------------------------------------------------------------*/

const COLUNAS = ["Data", "Descrição", "Categoria", "Tipo", "Recorrência", "Parcela", "Valor"] as const;

/** Uma linha da planilha, já com os tipos que o Excel entende. */
type Linha = [string, string, string, string, string, string, number];

/**
 * Protege contra fórmula em célula de texto.
 *
 * Excel e Google Sheets executam o que começa com =, +, - ou @. A
 * descrição pode ter vindo de um extrato que alguém mandou, então o
 * apóstrofo na frente garante que ali é texto.
 */
const texto = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

/** Mês a mês, do mais recente para o mais antigo, com o que interessa para escolher. */
export interface MesDisponivel {
  ym: string;
  rotulo: string;
  lancamentos: number;
  despesas: number;
  receitas: number;
}

export function mesesDisponiveis(tx: Transaction[]): MesDisponivel[] {
  const mapa = new Map<string, MesDisponivel>();
  for (const t of tx) {
    const ym = t.date.slice(0, 7);
    const m =
      mapa.get(ym) ??
      { ym, rotulo: monthLabel(ym), lancamentos: 0, despesas: 0, receitas: 0 };
    m.lancamentos++;
    /* Movimentação não entra em nenhum dos dois totais: é o mesmo
       dinheiro mudando de lugar, e somá-lo inventaria gasto ou receita. */
    if (t.kind === "despesa") m.despesas += t.amount;
    else if (t.kind === "receita") m.receitas += t.amount;
    mapa.set(ym, m);
  }
  return [...mapa.values()].sort((a, b) => b.ym.localeCompare(a.ym));
}

function linhas(tx: Transaction[], cats: Category[]): Linha[] {
  return [...tx]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t) => [
      t.date.split("-").reverse().join("/"),
      texto(t.description),
      texto(findCategory(cats, t.category).label),
      t.kind === "despesa" ? "Despesa" : t.kind === "receita" ? "Receita" : "Movimentação",
      // recorrência é coisa de despesa; nos outros tipos a célula fica vazia
      t.kind !== "despesa" ? "" : t.recurrence === "fixo" ? "Fixo" : "Variável",
      t.installment ? `${t.installment.current}/${t.installment.total}` : "",
      /* Sinal só onde ele significa alguma coisa: despesa tira do mês,
         receita põe. Movimentação não faz nem um nem outro, então vai
         sem sinal, com a coluna Tipo dizendo o que é. */
      t.kind === "despesa" ? -t.amount : t.amount,
    ]);
}

/**
 * Largura de cada coluna, medida pelo conteúdo.
 *
 * A conta é em caracteres, que é a unidade do Excel. Um piso garante que
 * o cabeçalho sempre cabe, e um teto impede que uma descrição gigante
 * empurre a planilha para fora da tela.
 */
function larguras(corpo: Linha[]): { wch: number }[] {
  return COLUNAS.map((titulo, i) => {
    const maior = corpo.reduce((max, linha) => {
      const v = linha[i];
      const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : String(v ?? "");
      return Math.max(max, s.length);
    }, titulo.length);
    // duas casas de folga para a célula não ficar encostada na divisória
    return { wch: Math.min(52, Math.max(titulo.length + 2, maior + 2)) };
  });
}

/** Junta os lançamentos dos meses escolhidos, em ordem de data. */
export function filtrarMeses(tx: Transaction[], meses: string[]): Transaction[] {
  const alvo = new Set(meses);
  return tx.filter((t) => alvo.has(t.date.slice(0, 7)));
}

/**
 * Prega a primeira linha no topo da planilha.
 *
 * A biblioteca não escreve painel congelado, então o trecho de XML que
 * define a visão da aba é trocado direto dentro do arquivo pronto. Se
 * qualquer coisa sair do esperado, o arquivo volta como estava.
 */
function congelarCabecalho(bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  const painel =
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>';
  return trocarNoZip(bytes, "xl/worksheets/sheet1.xml", (xml) =>
    xml.replace(/<sheetView([^>]*)\/>/, `<sheetView$1>${painel}</sheetView>`)
  );
}

function baixar(dados: BlobPart, nome: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([dados], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CSV de emergência, para quando a biblioteca da planilha não baixa. */
function csv(corpo: Linha[]): string {
  const cel = (v: string | number) => {
    const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [COLUNAS as unknown as string[], ...corpo]
    .map((r) => r.map(cel).join(";"))
    .join("\r\n");
}

export async function exportarPlanilha(
  tx: Transaction[],
  cats: Category[],
  nomeBase: string
): Promise<"planilha" | "csv"> {
  const corpo = linhas(tx, cats);

  try {
    const XLSX = await carregarSheetJS();
    const ws = XLSX.utils.aoa_to_sheet([COLUNAS as unknown as string[], ...corpo]);

    ws["!cols"] = larguras(corpo);
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: corpo.length, c: COLUNAS.length - 1 },
    }) };

    // a coluna de valor vira moeda de verdade, somável e filtrável
    for (let r = 1; r <= corpo.length; r++) {
      const ref = XLSX.utils.encode_cell({ r, c: COLUNAS.length - 1 });
      if (ws[ref]) ws[ref].z = 'R$ #,##0.00;[Red]-R$ #,##0.00';
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    baixar(
      congelarCabecalho(new Uint8Array(buf as ArrayBuffer)),
      `${nomeBase}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    return "planilha";
  } catch {
    // BOM para o Excel abrir os acentos certos
    baixar(`﻿${csv(corpo)}`, `${nomeBase}.csv`, "text/csv;charset=utf-8");
    return "csv";
  }
}
