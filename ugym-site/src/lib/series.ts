import { daysInMonth, shiftMonth, todayYM } from "./format";
import type { Ledger, Series, Transaction } from "./types";

/**
 * Identificador único. Precisa ser sempre um UUID válido: as chaves
 * primárias no Supabase são do tipo uuid e recusam qualquer outro formato,
 * e o app manda o id junto na inserção para não depender de ida e volta.
 */
export const uid = (): string => {
  const c: Partial<Crypto> | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (c) {
    if (typeof c.randomUUID === "function") return c.randomUUID();
    if (typeof c.getRandomValues === "function") {
      const b = c.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 0x0f) | 0x40;
      b[8] = (b[8] & 0x3f) | 0x80;
      const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    }
  }
  const r = () => Math.floor(Math.random() * 16).toString(16);
  const s = Array.from({ length: 32 }, r).join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20)}`;
};

const monthsBetween = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

const occurrenceId = (seriesId: string, ym: string) => `${seriesId}@${ym}`;

/**
 * Quantos meses à frente do mês corrente o app materializa de uma vez,
 * quando a série tem fim conhecido. Vale como freio: quem marcar "todo
 * mês até 2040" não cria quinhentas linhas numa abertura só. O resto
 * nasce com o passar dos meses, como sempre nasceu.
 */
const LIMITE_FUTURO = 24;

/**
 * Materializa as séries: cria os lançamentos que faltam de cada fixo
 * mensal e de cada parcelamento. Roda a cada abertura do app, então um
 * fixo aparece sozinho quando o mês vira.
 *
 * Até onde ir depende de a série ter fim marcado ou não:
 *
 * - Sem fim ("todo mês", para sempre): até o mês corrente. Não dá para
 *   adivinhar quando aquilo acaba, então nada é criado para o futuro.
 * - Com fim conhecido (um parcelamento, ou um fixo com "parar em algum
 *   mês"): até o fim, mesmo que ele esteja no futuro. Quem marca dez
 *   parcelas ou "todo mês até dezembro de 2027" já assumiu o
 *   compromisso inteiro, e o valor de ver isso é justamente olhar o mês
 *   que vem e encontrar lá o que já está comprometido. Era aqui o
 *   defeito: a série parava no mês corrente e os meses marcados
 *   apareciam vazios, apesar de o formulário prometer "vai de outubro a
 *   dezembro".
 */
export function materialize(ledger: Ledger, ref: string = todayYM()): Ledger {
  const existing = new Set(
    ledger.transactions.filter((t) => t.seriesId).map((t) => occurrenceId(t.seriesId!, t.date.slice(0, 7)))
  );
  const skips = new Set(ledger.skips);
  const created: Transaction[] = [];

  for (const s of ledger.series) {
    const ateHoje = monthsBetween(s.startYM, ref);
    /* O fim declarado da série, em número de meses depois do início.
       `null` quer dizer série sem fim, que é a única que para no mês
       corrente. */
    const fim =
      s.kind === "parcelado"
        ? (s.total ?? 1) - 1
        : s.endedYM
        ? monthsBetween(s.startYM, s.endedYM)
        : null;
    const limit = fim === null ? ateHoje : Math.min(fim, ateHoje + LIMITE_FUTURO);

    for (let i = 0; i <= limit; i++) {
      const ym = shiftMonth(s.startYM, i);
      const key = occurrenceId(s.id, ym);
      if (existing.has(key) || skips.has(key)) continue;

      const day = Math.min(s.template.day, daysInMonth(ym));
      created.push({
        id: uid(),
        description: s.template.description,
        amount: s.template.amount,
        kind: s.template.kind,
        category: s.template.category,
        recurrence: s.template.recurrence,
        date: `${ym}-${String(day).padStart(2, "0")}`,
        seriesId: s.id,
        ...(s.kind === "parcelado"
          ? { installment: { current: i + 1, total: s.total ?? 1 } }
          : {}),
      });
    }
  }

  if (!created.length) return ledger;
  return {
    ...ledger,
    transactions: [...ledger.transactions, ...created].sort((a, b) =>
      b.date.localeCompare(a.date)
    ),
  };
}

export const skipKey = (t: Transaction) =>
  t.seriesId ? occurrenceId(t.seriesId, t.date.slice(0, 7)) : null;

export function buildSeries(input: {
  description: string;
  amount: number;
  kind: Series["template"]["kind"];
  category: Series["template"]["category"];
  recurrence: Series["template"]["recurrence"];
  date: string;
  mode: "mensal" | "parcelado";
  total?: number;
  /** mês da última ocorrência de um fixo mensal, quando a pessoa marcou um fim */
  ateYM?: string;
  /** em qual parcela a compra já está, quando ela não começa na primeira */
  comecaEm?: number;
}): { series: Series; skips: string[] } {
  /* ----------------------------------------------------------------
     Começar no meio do parcelamento, sem coluna nova no banco.

     Quem lança "revisão do carro 5 de 6" está entrando numa compra que
     começou quatro meses atrás. O materialize numera as ocorrências a
     partir do início da série, então a série nasce com o início
     recuado quatro meses, e os quatro meses que já passaram entram em
     `skips`, que é a lista de ocorrências puladas que o app já tinha e
     já salva no banco.

     O resultado é exatamente o esperado: nada é criado para trás, a
     parcela deste mês sai numerada 5 de 6, e a última cai no mês certo.
     Nenhuma tabela mudou de forma para isso.
  ---------------------------------------------------------------- */
  const recuo = input.mode === "parcelado" ? Math.max(0, (input.comecaEm ?? 1) - 1) : 0;
  const startYM = shiftMonth(input.date.slice(0, 7), -recuo);
  const id = uid();

  const series: Series = {
    id,
    kind: input.mode,
    startYM,
    total: input.mode === "parcelado" ? input.total : undefined,
    ...(input.mode === "mensal" && input.ateYM ? { endedYM: input.ateYM } : {}),
    template: {
      description: input.description,
      amount: input.amount,
      kind: input.kind,
      category: input.category,
      recurrence: input.recurrence,
      day: Number(input.date.slice(8, 10)),
    },
  };

  const skips = Array.from({ length: recuo }, (_, i) =>
    occurrenceId(id, shiftMonth(startYM, i))
  );

  return { series, skips };
}
