import { daysInMonth, todayYM } from "../lib/format";
import { uid } from "../lib/series";
import type { Transaction } from "../lib/types";

/* ------------------------------------------------------------------
   Mês de exemplo do celular do topo.

   É um mês cheio, do dia 1 ao último, com dias vazios, dias pequenos e
   dias pesados, para o calendário ter tons de verde de verdade em vez
   de tudo na mesma intensidade. Os lançamentos entram em ordem de data
   conforme o visitante mexe o mouse, então o mês vai "acontecendo" na
   frente dele.

   Os valores são gerados por uma sequência determinística: o mesmo mês
   sai igual em todo carregamento, sem depender de sorteio real.
-------------------------------------------------------------------*/

export const HERO_YM = todayYM();
/** onde o contador começa, antes de qualquer movimento */
export const HERO_FLOOR = 500;
/** onde o mês fecha quando o visitante enche tudo */
const TETO = 10000;

/** gerador determinístico simples, para o mês nunca mudar entre visitas */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Gasto = [dia: number, descricao: string, valor: number, categoria: string, fixo?: boolean];

/** compras variáveis distribuídas pelo mês, com peso diferente por dia */
const VARIAVEIS: [desc: string, cat: string, min: number, max: number][] = [
  ["Supermercado", "mercado", 240, 620],
  ["Padaria", "mercado", 16, 44],
  ["Almoço", "restaurante", 38, 78],
  ["Jantar fora", "restaurante", 120, 310],
  ["Delivery", "restaurante", 45, 110],
  ["Combustível", "combustivel", 180, 340],
  ["Aplicativo de transporte", "transporte", 22, 64],
  ["Farmácia", "saude", 34, 210],
  ["Cinema", "entretenimento", 60, 140],
  ["Livraria", "educacao", 55, 180],
  ["Roupa", "vestuario", 130, 380],
  ["Presente", "compras", 90, 290],
  ["Corte de cabelo", "pessoal", 55, 55],
  ["Pet shop", "outros", 95, 240],
];

function montar(): Transaction[] {
  const ym = HERO_YM;
  const dias = daysInMonth(ym);
  const rnd = seeded(20260914);

  const fixos: Gasto[] = [
    [5, "Aluguel", 1180, "casa", true],
    [8, "Academia", 139, "academia", true],
    [10, "Internet", 129.9, "casa", true],
    [12, "Assinaturas", 64.9, "assinaturas", true],
    [15, "Plano de celular", 59.9, "casa", true],
    [20, "Seguro do carro", 214.3, "carro", true],
  ];

  const linhas: Gasto[] = [...fixos];

  for (let dia = 1; dia <= dias; dia++) {
    // sorteios independentes: um decide se o dia tem gasto, outro quantos
    if (rnd() < 0.2) continue; // cerca de um quinto dos dias fica em branco
    const d = rnd();
    const quantos = d > 0.82 ? 3 : d > 0.5 ? 2 : 1;
    for (let i = 0; i < quantos; i++) {
      const [desc, cat, min, max] = VARIAVEIS[Math.floor(rnd() * VARIAVEIS.length)];
      const valor = min + rnd() * (max - min);
      linhas.push([dia, desc, valor, cat]);
    }
  }

  /* Ajusta as compras variáveis para o mês fechar perto do teto, sem
     mexer nos fixos, que têm valores reconhecíveis. */
  const somaFixos = fixos.reduce((s, l) => s + l[2], 0);
  const somaVar = linhas.filter((l) => !l[4]).reduce((s, l) => s + l[2], 0);
  const escala = (TETO - somaFixos) / somaVar;
  for (const l of linhas) if (!l[4]) l[2] = Math.round(l[2] * escala * 100) / 100;

  linhas.sort((a, b) => a[0] - b[0]);

  const despesas: Transaction[] = linhas.map(([dia, description, amount, category, fixo]) => ({
    id: uid(),
    description,
    amount,
    kind: "despesa",
    category,
    date: `${ym}-${String(dia).padStart(2, "0")}`,
    recurrence: fixo ? "fixo" : "variavel",
  }));

  /* A renda é calibrada para o mês fechar numa faixa saudável, porque o
     topo do site mostra a nota junto do nome e não faria sentido a vitrine
     abrir com um mês ruim. */
  const total = despesas.reduce((s, t) => s + t.amount, 0);
  const renda = Math.round(total / 0.68 / 100) * 100;

  return [
    {
      id: uid(),
      description: "Salário",
      amount: renda,
      kind: "receita",
      category: "salario",
      date: `${ym}-05`,
      recurrence: "fixo",
    },
    ...despesas,
  ];
}

export const HERO_TX = montar();

/** despesas em ordem de data: é nessa ordem que o mês vai aparecendo */
export const HERO_GASTOS = HERO_TX.filter((t) => t.kind === "despesa");
export const HERO_RECEITAS = HERO_TX.filter((t) => t.kind !== "despesa");
export const HERO_TOTAL = HERO_GASTOS.reduce((s, t) => s + t.amount, 0);
