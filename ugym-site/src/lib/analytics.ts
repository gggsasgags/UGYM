import { findCategory } from "./categories";
import { daysInMonth, money, monthLabel, shiftMonth, todayYM, weekdayOf, ymOf } from "./format";
import type { Category, Transaction } from "./types";

export interface MonthTotals {
  ym: string;
  receitas: number;
  despesas: number;
  saldo: number;
  count: number;
  hasData: boolean;
}

export const inMonth = (tx: Transaction[], ym: string) =>
  tx.filter((t) => t.date.startsWith(ym));

export function monthTotals(tx: Transaction[], ym: string): MonthTotals {
  const rows = inMonth(tx, ym);
  const receitas = rows.filter((t) => t.kind === "receita").reduce((s, t) => s + t.amount, 0);
  const despesas = rows.filter((t) => t.kind === "despesa").reduce((s, t) => s + t.amount, 0);
  /* Movimentação não é lançamento do mês para efeito de contagem: ela
     aparece na lista, mas o número embaixo do total gasto contaria uma
     transferência como se fosse mais um gasto. */
  const contados = rows.filter((t) => t.kind !== "movimentacao").length;
  return {
    ym,
    receitas,
    despesas,
    saldo: receitas - despesas,
    count: contados,
    hasData: rows.length > 0,
  };
}

export function splitRecurrence(tx: Transaction[], ym: string) {
  const rows = inMonth(tx, ym).filter((t) => t.kind === "despesa");
  const fixo = rows.filter((t) => t.recurrence === "fixo").reduce((s, t) => s + t.amount, 0);
  const variavel = rows
    .filter((t) => t.recurrence === "variavel")
    .reduce((s, t) => s + t.amount, 0);
  return {
    fixo,
    variavel,
    total: fixo + variavel,
    fixoCount: rows.filter((t) => t.recurrence === "fixo").length,
    variavelCount: rows.filter((t) => t.recurrence === "variavel").length,
  };
}

export interface CategorySlice {
  id: string;
  label: string;
  emoji: string;
  total: number;
  share: number;
}

export function byCategory(
  tx: Transaction[],
  ym: string,
  cats: Category[],
  kind: "despesa" | "receita" = "despesa"
): CategorySlice[] {
  const rows = inMonth(tx, ym).filter((t) => t.kind === kind);
  const total = rows.reduce((s, t) => s + t.amount, 0) || 1;
  const map = new Map<string, number>();
  /* Agrupa pela categoria resolvida, não pelo texto guardado no
     lançamento. Um id que não existe mais cai em "Outros", e todos eles
     precisam cair no MESMO "Outros": senão a tela mostra a mesma linha
     repetida várias vezes, uma para cada id perdido. */
  for (const t of rows) {
    const id = findCategory(cats, t.category).id;
    map.set(id, (map.get(id) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([id, v]) => {
      const c = findCategory(cats, id);
      return { id, label: c.label, emoji: c.emoji, total: v, share: (v / total) * 100 };
    })
    .sort((a, b) => b.total - a.total);
}

/** matriz categoria × mês, usada no modo planilha */
export function categoryMatrix(
  tx: Transaction[],
  months: string[],
  cats: Category[],
  kind: "despesa" | "receita" | "ambos" = "despesa"
) {
  const rows = tx.filter((t) => (kind === "ambos" ? true : t.kind === kind));
  const map = new Map<string, Map<string, number>>();
  for (const t of rows) {
    const ym = t.date.slice(0, 7);
    if (!months.includes(ym)) continue;
    // pela categoria resolvida, pelo mesmo motivo de byCategory
    const id = findCategory(cats, t.category).id;
    if (!map.has(id)) map.set(id, new Map());
    const row = map.get(id)!;
    row.set(ym, (row.get(ym) ?? 0) + t.amount);
  }
  const out = [...map.entries()].map(([id, row]) => {
    const c = findCategory(cats, id);
    const values = months.map((m) => row.get(m) ?? 0);
    return {
      id,
      label: c.label,
      emoji: c.emoji,
      values,
      total: values.reduce((s, v) => s + v, 0),
    };
  });
  out.sort((a, b) => b.total - a.total);
  const columnTotals = months.map((_, i) => out.reduce((s, r) => s + r.values[i], 0));
  const max = Math.max(1, ...out.flatMap((r) => r.values));
  return { rows: out, columnTotals, grandTotal: columnTotals.reduce((s, v) => s + v, 0), max };
}

/** ritmo do mês: média por dia e projeção de fechamento */
/**
 * O ritmo do mês, e a projeção de onde ele fecha.
 *
 * Gasto fixo não tem ritmo. Ele cai inteiro num dia só, quando a pessoa
 * senta e paga as contas, e some do resto do mês. Diluir esse dia na
 * média diária produzia um número sem pé nem cabeça: quem pagou R$ 1.500
 * de contas no dia 3 aparecia caminhando para gastar mais do que ganha
 * no mês inteiro.
 *
 * Então o cálculo separa os dois. O ritmo é só do que varia, porque é
 * isso que se repete dia após dia. O fixo entra inteiro na projeção,
 * porque o mês já sabe quanto ele vai ser: as ocorrências do mês inteiro
 * já estão lançadas, inclusive as dos dias que ainda não chegaram.
 */
export function pace(tx: Transaction[], ym: string, ref: string = todayYM()) {
  const total = daysInMonth(ym);
  const elapsed = ym === ref ? Math.min(total, new Date().getDate()) : ym < ref ? total : 0;
  const rows = inMonth(tx, ym).filter((t) => t.kind === "despesa");
  const fixo = rows.filter((t) => t.recurrence === "fixo").reduce((s, t) => s + t.amount, 0);
  const variavel = rows
    .filter((t) => t.recurrence === "variavel")
    .reduce((s, t) => s + t.amount, 0);
  const spent = fixo + variavel;
  /* Média por dia do que varia: é o número que responde "estou gastando
     muito?" sem a distorção do dia das contas. */
  const perDay = elapsed > 0 ? variavel / elapsed : 0;
  return {
    spent,
    fixo,
    variavel,
    elapsed,
    total,
    perDay,
    projected: fixo + perDay * total,
    closed: ym < ref,
  };
}

/**
 * Quanto saiu em cada dia da semana, só do que varia.
 *
 * Este gráfico é sobre hábito: em que dia a pessoa gasta mais quando
 * decide gastar. Conta de luz e aluguel não são hábito, são calendário,
 * e caem sempre no mesmo dia. Com elas dentro, o gráfico vira um
 * paredão num dia só, mês após mês, e nunca conta nada de novo.
 */
export function byWeekday(tx: Transaction[], ym: string) {
  const order = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
  const map = new Map(order.map((d) => [d, 0]));
  const doMes = inMonth(tx, ym).filter(
    (x) => x.kind === "despesa" && x.recurrence === "variavel"
  );
  for (const t of doMes) {
    const d = weekdayOf(t.date);
    map.set(d, (map.get(d) ?? 0) + t.amount);
  }
  return order.map((d) => ({ day: d, total: map.get(d) ?? 0 }));
}

/** total gasto em cada dia do mês, do dia 1 ao último */
export function dailySpend(tx: Transaction[], ym: string) {
  const n = daysInMonth(ym);
  const arr = Array.from({ length: n }, (_, i) => ({ day: i + 1, total: 0, count: 0 }));
  for (const t of inMonth(tx, ym).filter((x) => x.kind === "despesa")) {
    const d = Number(t.date.slice(8, 10));
    if (arr[d - 1]) {
      arr[d - 1].total += t.amount;
      arr[d - 1].count += 1;
    }
  }
  return arr;
}

export function peakDay(tx: Transaction[], ym: string) {
  const days = dailySpend(tx, ym);
  const monthTotal = days.reduce((s, d) => s + d.total, 0) || 1;
  const best = days.reduce((a, b) => (b.total > a.total ? b : a), days[0]);
  return { day: best.day, total: best.total, share: (best.total / monthTotal) * 100 };
}

/* ═══════════════════ relatório mensal ═══════════════════ */

export type Tier = "Excelente" | "Saudável" | "Regular" | "Atenção";

export interface Pillar {
  id: "controle" | "consistencia" | "organizacao";
  label: string;
  weight: number;
  earned: number;
  metric: string;
  detail: string;
}

export interface MonthReport {
  ym: string;
  /** o mês já virou, então o relatório é definitivo */
  closed: boolean;
  /** data em que o relatório fecha, no formato "01/10/2026" */
  releaseDate: string;
  score: number;
  tier: Tier;
  burn: number;
  totals: MonthTotals;
  pillars: Pillar[];
  highlights: string[];
  advice: string[];
}

/** régua linear: `best` vale os pontos cheios, `worst` vale zero */
const band = (value: number, best: number, worst: number, points: number) => {
  if (best === worst) return points;
  const t = (worst - value) / (worst - best);
  return Math.max(0, Math.min(1, t)) * points;
};

const tierOf = (score: number): Tier =>
  score >= 8.5 ? "Excelente" : score >= 7 ? "Saudável" : score >= 5 ? "Regular" : "Atenção";

const pct1 = (v: number) => `${Math.round(v)}%`;

export function monthReport(
  tx: Transaction[],
  ym: string,
  cats: Category[] = [],
  ref: string = todayYM()
): MonthReport {
  const totals = monthTotals(tx, ym);
  const split = splitRecurrence(tx, ym);
  const days = dailySpend(tx, ym);
  const slices = byCategory(tx, ym, cats);
  const peak = peakDay(tx, ym);

  const closed = ym < ref;
  const nextYM = shiftMonth(ym, 1);
  const releaseDate = `01/${nextYM.slice(5, 7)}/${nextYM.slice(0, 4)}`;

  const total = daysInMonth(ym);
  const elapsed = closed ? total : Math.min(total, Number(ref === ym ? new Date().getDate() : total));
  const daysWithSpend = days.filter((d) => d.total > 0).length;
  const spendRate = elapsed > 0 ? (daysWithSpend / elapsed) * 100 : 0;

  const burn = totals.receitas > 0 ? (totals.despesas / totals.receitas) * 100 : 0;
  const semRenda = totals.receitas === 0;

  /* ---------- 1. Controle de gastos (50) ---------- */
  const controlePts = semRenda ? 0 : band(burn, 50, 110, 50);
  const controle: Pillar = {
    id: "controle",
    label: "Controle de gastos",
    weight: 50,
    earned: controlePts,
    metric: semRenda ? "sem renda registrada" : `${pct1(burn)} da renda`,
    detail: semRenda
      ? "Não há receita registrada neste mês, então não dá para medir a proporção entre o que entrou e o que saiu. Registre seu salário para este pilar passar a contar."
      : burn <= 50
      ? `Você gastou ${pct1(burn)} do que recebeu e guardou o restante. É a faixa que sustenta reserva sem aperto.`
      : burn <= 80
      ? `Você gastou ${pct1(burn)} do que recebeu. Sobra, mas a margem já é estreita para um imprevisto.`
      : burn <= 100
      ? `Você gastou ${pct1(burn)} da renda. Praticamente tudo o que entrou saiu no mesmo mês.`
      : `Você gastou ${pct1(burn)} da renda, ou seja, mais do que recebeu. A diferença saiu de reserva ou de crédito.`,
  };

  /* ---------- 2. Consistência (30) ---------- */
  const picoPts = split.total > 0 ? band(peak.share, 15, 60, 20) : 0;
  const espalhaPts = band(spendRate, 40, 8, 10);
  const consistencia: Pillar = {
    id: "consistencia",
    label: "Consistência",
    weight: 30,
    earned: picoPts + espalhaPts,
    metric: `${pct1(peak.share)} no maior dia`,
    detail:
      split.total === 0
        ? "Nenhuma despesa registrada, então não há ritmo a avaliar."
        : peak.share > 45
        ? `O dia ${peak.day} concentrou ${pct1(peak.share)} de tudo o que você gastou, e houve movimento em ${daysWithSpend} de ${elapsed} dias. Meses com um pico assim costumam ser decididos por uma compra só, o que torna difícil prever o próximo.`
        : peak.share > 25
        ? `O maior dia foi ${peak.day}, com ${pct1(peak.share)} do mês, e houve movimento em ${daysWithSpend} de ${elapsed} dias. O ritmo é razoável, com um dia puxando mais que os outros.`
        : `Os gastos ficaram bem distribuídos: o maior dia respondeu por ${pct1(peak.share)} do mês e houve movimento em ${daysWithSpend} de ${elapsed} dias.`,
  };

  /* ---------- 3. Organização (20) ---------- */
  const semCategoria = inMonth(tx, ym)
    .filter((t) => t.kind === "despesa" && t.category === "outros")
    .reduce((s, t) => s + t.amount, 0);
  const catShare = split.total > 0 ? ((split.total - semCategoria) / split.total) * 100 : 100;
  const comprometimento = totals.receitas > 0 ? (split.fixo / totals.receitas) * 100 : 100;

  const catPts = band(catShare, 95, 60, 8);
  const regPts = band(spendRate, 33, 8, 6);
  const compPts = semRenda ? 0 : band(comprometimento, 50, 85, 6);

  const organizacao: Pillar = {
    id: "organizacao",
    label: "Organização",
    weight: 20,
    earned: catPts + regPts + compPts,
    metric: `${pct1(comprometimento)} comprometido`,
    detail: [
      catShare >= 95
        ? "Praticamente tudo está categorizado."
        : `${pct1(100 - catShare)} das despesas ficaram em “Outros”, o que esconde para onde o dinheiro foi.`,
      semRenda
        ? ""
        : comprometimento <= 50
        ? `Os gastos fixos ocupam ${pct1(comprometimento)} da renda, deixando espaço real para decidir.`
        : comprometimento <= 75
        ? `Os fixos já ocupam ${pct1(comprometimento)} da renda, então boa parte do mês é decidida antes de começar.`
        : `Os fixos comprometem ${pct1(comprometimento)} da renda. Sobra pouco para ajustar quando algo sai do previsto.`,
    ]
      .filter(Boolean)
      .join(" "),
  };

  const pillars = [controle, consistencia, organizacao];
  const raw = pillars.reduce((s, p) => s + p.earned, 0);
  const score = Math.round((raw / 10) * 10) / 10;

  /* ---------- observações ---------- */
  const prev = monthTotals(tx, shiftMonth(ym, -1));
  const prevCats = byCategory(tx, shiftMonth(ym, -1), cats);
  const highlights: string[] = [];

  if (slices[0]) {
    highlights.push(
      `${slices[0].label} foi sua maior categoria: ${money(slices[0].total)}, ${pct1(slices[0].share)} do mês.`
    );
  }

  if (prev.hasData && prev.despesas > 0 && split.total > 0) {
    const delta = ((split.total - prev.despesas) / prev.despesas) * 100;
    highlights.push(
      Math.abs(delta) < 5
        ? `Você gastou praticamente o mesmo que em ${monthLabel(shiftMonth(ym, -1)).toLowerCase()}, variação de ${pct1(Math.abs(delta))}.`
        : delta > 0
        ? `Os gastos subiram ${pct1(delta)} em relação a ${monthLabel(shiftMonth(ym, -1)).toLowerCase()}, uma diferença de ${money(split.total - prev.despesas)}.`
        : `Os gastos caíram ${pct1(Math.abs(delta))} em relação a ${monthLabel(shiftMonth(ym, -1)).toLowerCase()}, uma economia de ${money(prev.despesas - split.total)}.`
    );

    let worst: { label: string; delta: number } | null = null;
    for (const c of slices) {
      const before = prevCats.find((p) => p.id === c.id)?.total ?? 0;
      const d = c.total - before;
      if (!worst || d > worst.delta) worst = { label: c.label, delta: d };
    }
    if (worst && worst.delta > 0) {
      highlights.push(
        `A categoria que mais cresceu foi ${worst.label}, com ${money(worst.delta)} a mais que no mês anterior.`
      );
    }
  }

  const quietDays = elapsed - daysWithSpend;
  if (quietDays > 0 && split.total > 0) {
    highlights.push(
      `Você passou ${quietDays} ${quietDays === 1 ? "dia" : "dias"} sem registrar nenhum gasto.`
    );
  }

  const parcelas = inMonth(tx, ym).filter((t) => t.installment);
  if (parcelas.length) {
    const restante = parcelas.reduce(
      (s, t) => s + t.amount * (t.installment!.total - t.installment!.current),
      0
    );
    highlights.push(
      `${parcelas.length} ${parcelas.length === 1 ? "parcelamento segue" : "parcelamentos seguem"} em aberto, somando ${money(restante)} ainda a pagar nos próximos meses.`
    );
  }

  /* ---------- o que fazer ---------- */
  const advice: string[] = [];
  if (!semRenda && burn > 80) {
    const teto = totals.receitas * 0.7;
    advice.push(
      `Para fechar o próximo mês em 70% da renda, o teto de gastos seria ${money(teto)}, ou ${money(teto / daysInMonth(nextYM))} por dia.`
    );
  }
  if (peak.share > 40 && split.total > 0) {
    advice.push(
      `Compras grandes concentradas em um dia distorcem o mês inteiro. Parcelar ou antecipar parte delas deixa o ritmo mais previsível.`
    );
  }
  if (catShare < 90) {
    advice.push(
      `Reclassificar o que está em “Outros” melhora a leitura das próximas análises e vale pontos aqui.`
    );
  }
  if (!semRenda && comprometimento > 70) {
    advice.push(
      `Seus fixos somam ${money(split.fixo)} por mês. Revisar assinaturas e contratos é o ajuste que rende mais, porque vale para todos os meses seguintes.`
    );
  }
  if (!advice.length) {
    advice.push(
      `O mês fechou dentro de uma faixa saudável. Manter o mesmo padrão nos próximos dois meses já forma uma reserva relevante.`
    );
  }

  return {
    ym,
    closed,
    releaseDate,
    score,
    tier: tierOf(score),
    burn,
    totals,
    pillars,
    highlights,
    advice,
  };
}

export const monthsWithData = (tx: Transaction[]) =>
  [...new Set(tx.map((t) => ymOf(t.date)))].sort();
