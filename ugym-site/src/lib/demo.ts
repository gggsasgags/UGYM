import { shiftMonth, todayYM } from "./format";
import { BASE_CATEGORIES } from "./categories";
import { DEFAULT_HOME } from "./home";
import { uid } from "./series";
import type { Ledger, Series, Transaction } from "./types";

/**
 * Dados de demonstração: cinco meses terminando no mês corrente.
 *
 * Tudo aqui é genérico de propósito. São gastos que qualquer pessoa
 * reconhece, sem nome de loja, de academia, de carro ou de gente real,
 * porque essa carteira aparece para todo mundo que cria conta com
 * dados de exemplo e também nas telas do site.
 * Os compromissos recorrentes entram como séries, então continuam
 * aparecendo sozinhos nos meses seguintes, exatamente como acontece
 * com um lançamento fixo criado pelo usuário.
 */

type Seed = [desc: string, amount: number, cat: string, day: number];

/** lançamentos avulsos, do mês mais antigo até o corrente */
const SEEDS: Seed[][] = [
  [
    ["Supermercado", 418.4, "mercado", 6],
    ["Supermercado", 264.75, "mercado", 20],
    ["Combustível", 192.3, "combustivel", 9],
    ["Jantar fora", 121.9, "restaurante", 23],
    ["Cinema", 64, "entretenimento", 15],
    ["Farmácia", 52.7, "saude", 26],
  ],
  [
    ["Supermercado", 357.1, "mercado", 7],
    ["Combustível", 168.4, "combustivel", 11],
    ["Camiseta", 132, "vestuario", 14],
    ["Pizzaria", 98.5, "restaurante", 21],
    ["Ingresso de show", 85, "entretenimento", 27],
  ],
  [
    ["Passagens aéreas", 874.2, "viagem", 2],
    ["Hospedagem", 655, "viagem", 4],
    ["Supermercado", 292.6, "mercado", 14],
    ["Combustível", 205.8, "combustivel", 6],
    ["Refeições na viagem", 293.4, "restaurante", 5],
    ["Curso online", 149, "educacao", 22],
  ],
  [
    ["Supermercado", 391.25, "mercado", 9],
    ["Combustível", 182.6, "combustivel", 7],
    ["Almoço em família", 238, "restaurante", 22],
    ["Tênis de corrida", 379, "vestuario", 19],
    ["Streaming avulso", 34.9, "entretenimento", 25],
  ],
  [
    ["Combustível", 171.55, "combustivel", 12],
    ["Pneus novos", 498.9, "carro", 11],
    ["Padaria", 27.4, "mercado", 11],
    ["Aplicativo de transporte", 38.6, "transporte", 14],
    ["Presente de aniversário", 95, "compras", 18],
  ],
];


const SPAN = SEEDS.length - 1;

export function demoLedger(ref: string = todayYM()): Ledger {
  const oldest = shiftMonth(ref, -SPAN);

  const mensal = (
    description: string,
    amount: number,
    category: string,
    day: number,
    kind: "despesa" | "receita" = "despesa"
  ): Series => ({
    id: uid(),
    kind: "mensal",
    startYM: oldest,
    template: { description, amount, kind, category, recurrence: "fixo", day },
  });

  const parcelado = (
    description: string,
    amount: number,
    category: string,
    day: number,
    total: number,
    startsAgo: number
  ): Series => ({
    id: uid(),
    kind: "parcelado",
    startYM: shiftMonth(ref, -startsAgo),
    total,
    template: { description, amount, kind: "despesa", category, recurrence: "fixo", day },
  });

  const series: Series[] = [
    mensal("Salário", 3850, "salario", 5, "receita"),
    mensal("Aluguel", 1180, "casa", 5),
    mensal("Academia", 139, "academia", 8),
    mensal("Internet", 129.9, "casa", 10),
    mensal("Assinaturas", 64.9, "assinaturas", 12),
    mensal("Plano de celular", 59.9, "casa", 15),
    mensal("Corte de cabelo", 55, "pessoal", 17),
    parcelado("Parcelamento da viagem", 312.4, "viagem", 3, 3, 2),
    parcelado("Revisão do carro", 158.9, "carro", 11, 8, 2),
    parcelado("Seguro do carro", 214.3, "carro", 11, 10, 1),
  ];

  const transactions: Transaction[] = [];
  SEEDS.forEach((rows, mi) => {
    const ym = shiftMonth(ref, mi - SPAN);
    rows.forEach(([description, amount, category, day]) => {
      transactions.push({
        id: uid(),
        description,
        amount,
        kind: "despesa",
        category,
        date: `${ym}-${String(day).padStart(2, "0")}`,
        recurrence: "variavel",
      });
    });
  });

  return {
    transactions,
    series,
    skips: [],
    categories: BASE_CATEGORIES,
    home: DEFAULT_HOME,
    theme: "escuro",
    calc: false,
  };
}
