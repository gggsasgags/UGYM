import { shiftMonth, todayYM } from "./format";
import type { Transaction } from "./types";

/**
 * Mês de exemplo da seção "Nota do mês" do site.
 *
 * Não é número inventado na mão: são lançamentos de verdade que passam pelo
 * mesmo `monthReport` do aplicativo. A nota, os três pilares e a porcentagem
 * da renda saem todos do mesmo cálculo, então é impossível o círculo dizer
 * uma coisa e o texto de baixo dizer outra.
 *
 * O mês retratado é o anterior ao atual, porque no Gastô o relatório só fecha
 * no dia 1 do mês seguinte.
 */

type Seed = [desc: string, amount: number, cat: string, day: number, fixo?: boolean];

const RENDA: Seed[] = [["Salário", 6000, "salario", 5, true]];

const GASTOS: Seed[] = [
  ["Mercado do mês", 372, "mercado", 3],
  ["Aluguel", 1100, "casa", 5, true],
  ["Celular", 75, "casa", 5, true],
  ["Internet", 120, "casa", 8, true],
  ["Gasolina", 186, "combustivel", 9],
  ["Mercado da quinzena", 286, "mercado", 12],
  ["Academia", 130, "academia", 15, true],
  ["Assinaturas", 75, "assinaturas", 15, true],
  ["Jantar fora", 168, "restaurante", 22],
  ["Mercado da quinzena", 302, "mercado", 22],
  ["Presente de aniversário", 126, "compras", 22],
];

const mk = (seeds: Seed[], ym: string, kind: Transaction["kind"]): Transaction[] =>
  seeds.map(([description, amount, category, day, fixo], i) => ({
    id: `show-${kind}-${i}`,
    description,
    amount,
    kind,
    category,
    date: `${ym}-${String(day).padStart(2, "0")}`,
    recurrence: fixo ? "fixo" : "variavel",
  }));

/** mês fechado mais recente */
export const SHOWCASE_YM = shiftMonth(todayYM(), -1);

export const SHOWCASE_TX: Transaction[] = [
  ...mk(RENDA, SHOWCASE_YM, "receita"),
  ...mk(GASTOS, SHOWCASE_YM, "despesa"),
];
