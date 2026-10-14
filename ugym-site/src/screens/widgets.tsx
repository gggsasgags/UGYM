import { useState } from "react";
import { SpendCalendar } from "../components/Calendar";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { findCategory } from "../lib/categories";
import {
  byCategory,
  type CategorySlice,
  byWeekday,
  inMonth,
  monthTotals,
  pace,
  splitRecurrence,
} from "../lib/analytics";
import { lastMonths, money, monthShort, pct, shiftMonth } from "../lib/format";
import type { Category, Recurrence, Transaction } from "../lib/types";
import { Donut, MonthBars, WeekdayBars } from "./parts";

export interface WidgetProps {
  tx: Transaction[];
  ym: string;
  cats: Category[];
  today?: string;
}

function Head({ icon, title, aside }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; aside?: React.ReactNode }) {
  return (
    <div className="card__head">
      <span className="card__title">
        <Icon name={icon} size={15} />
        {title}
      </span>
      {aside}
    </div>
  );
}

/* --------------------------- categorias --------------------------- */

/* O widget mostra sete, que é o que cabe sem virar parede de texto. Quem
   tem doze categorias não pode ficar sem ver as cinco de baixo, então elas
   não somem: ficam atrás de um botão que abre a lista inteira, rolável. */

function LinhaDaCategoria({ c, max, topo }: { c: CategorySlice; max: number; topo: boolean }) {
  return (
    <div className="catbar__row">
      <span className="catbar__name">
        <span className="emo">{c.emoji}</span>
        {c.label}
      </span>
      <span className="catbar__val">
        <span className="num">{money(c.total)}</span> <span className="dim">{pct(c.share)}</span>
      </span>
      <span className="catbar__track">
        <span
          className={`catbar__fill${topo ? " catbar__fill--top" : ""}`}
          style={{ width: `${(c.total / max) * 100}%` }}
        />
      </span>
    </div>
  );
}

function Categories({ tx, ym, cats }: WidgetProps) {
  const list = byCategory(tx, ym, cats);
  const max = list[0]?.total ?? 1;
  const [todas, setTodas] = useState(false);
  const CABEM = 7;

  return (
    <div className="card">
      <Head
        icon="filter"
        title="Gastos por categoria"
        aside={<span className="tagsoft num">{list.length}</span>}
      />
      {list.length === 0 ? (
        <p className="dim">Sem despesas neste mês.</p>
      ) : (
        <>
          <div className="catbar">
            {list.slice(0, CABEM).map((c, i) => (
              <LinhaDaCategoria key={c.id} c={c} max={max} topo={i === 0} />
            ))}
          </div>
          {list.length > CABEM && (
            <button type="button" className="vermais" onClick={() => setTodas(true)}>
              Ver todas as {list.length}
              <Icon name="chevronRight" size={14} />
            </button>
          )}
        </>
      )}
      {todas && (
        <Sheet title="Gastos por categoria" onClose={() => setTodas(false)}>
          <div className="catbar catbar--folha">
            {list.map((c, i) => (
              <LinhaDaCategoria key={c.id} c={c} max={max} topo={i === 0} />
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

/* ------------------------ fixos e variáveis ------------------------ */

/* O gráfico dizia quanto, e nunca o quê. Saber que 62% do mês é fixo não
   ajuda ninguém enquanto não der para ver qual é a lista, e a lista é
   justamente onde mora a decisão de cortar. Então as duas metades viram
   botão: a fatia no anel e a linha na legenda abrem a mesma folha.

   A folha ordena por valor, e não por data, porque quem abre está
   procurando o que pesa, e não o que aconteceu ontem. */

function ListaDoTipo({
  tx,
  ym,
  cats,
  tipo,
  onClose,
}: WidgetProps & { tipo: Recurrence; onClose: () => void }) {
  const rows = inMonth(tx, ym)
    .filter((t) => t.kind === "despesa" && t.recurrence === tipo)
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, t) => s + t.amount, 0);
  const titulo = tipo === "fixo" ? "Gastos fixos do mês" : "Gastos variáveis do mês";

  return (
    <Sheet title={titulo} onClose={onClose}>
      <div className="listaTipo__topo">
        <span className="num listaTipo__total">{money(total)}</span>
        <span className="dim">
          {rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="dim">
          {tipo === "fixo"
            ? "Nenhum gasto fixo neste mês."
            : "Nenhum gasto variável neste mês."}
        </p>
      ) : (
        <ul className="ranklist ranklist--plain listaTipo__lista">
          {rows.map((t) => (
            <li key={t.id}>
              <span className="emo">{findCategory(cats, t.category).emoji}</span>
              <span className="ranklist__txt">
                <strong>{t.description}</strong>
                <span className="dim">
                  dia {t.date.slice(8, 10)} · {findCategory(cats, t.category).label}
                </span>
              </span>
              <span className="num ranklist__v">{money(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function Split({ tx, ym, cats, today }: WidgetProps) {
  const s = splitRecurrence(tx, ym);
  const denom = s.total || 1;
  const [aberto, setAberto] = useState<Recurrence | null>(null);

  const linha = (tipo: Recurrence, nome: string, valor: number, qtd: number, cor: string) => (
    <button
      type="button"
      className="legend__row legend__row--toque"
      onClick={() => setAberto(tipo)}
      aria-label={`Ver os ${qtd} lançamentos ${nome.toLowerCase()} do mês`}
    >
      <span className="legend__swatch" style={{ background: cor }} />
      <div>
        <div className="legend__name">{nome}</div>
        <div className="legend__sub num">
          {qtd} {qtd === 1 ? "lançamento" : "lançamentos"}
        </div>
      </div>
      <div>
        <div className="legend__val num">{money(valor)}</div>
        <div className="legend__pct num">{pct((valor / denom) * 100)}</div>
      </div>
      <Icon name="chevronRight" size={15} />
    </button>
  );

  return (
    <div className="card">
      <Head icon="assinaturas" title="Fixos e variáveis" />
      <Donut
        caption="Total gastos"
        total={s.total}
        slices={[
          { label: "Fixos", value: s.fixo, color: "var(--ink)", onClick: () => setAberto("fixo") },
          {
            label: "Variáveis",
            value: s.variavel,
            color: "var(--pos)",
            onClick: () => setAberto("variavel"),
          },
        ]}
      />
      <div className="legend">
        {linha("fixo", "Fixos", s.fixo, s.fixoCount, "var(--ink)")}
        {linha("variavel", "Variáveis", s.variavel, s.variavelCount, "var(--pos)")}
      </div>
      {aberto && (
        <ListaDoTipo
          tx={tx}
          ym={ym}
          cats={cats}
          today={today}
          tipo={aberto}
          onClose={() => setAberto(null)}
        />
      )}
    </div>
  );
}

/* ----------------------------- ritmo ----------------------------- */

function Pace({ tx, ym }: WidgetProps) {
  const p = pace(tx, ym);
  const progress = p.total > 0 ? (p.elapsed / p.total) * 100 : 0;

  return (
    <div className="card">
      <Head icon="spark" title="Ritmo do mês" />
      <div className="duo">
        <div className="duo__i">
          <span className="duo__l">Média por dia, sem os fixos</span>
          <span className="duo__v num">{money(p.perDay)}</span>
        </div>
        <div className="duo__i duo__i--accent">
          <span className="duo__l">{p.closed ? "Fechou em" : "Projeção do mês"}</span>
          <span className="duo__v num">{money(p.closed ? p.spent : p.projected)}</span>
        </div>
      </div>
      <div className="prog">
        <span className="prog__fill" style={{ width: `${progress}%` }} />
      </div>
      <p className="dim">
        {p.closed
          ? `Mês fechado, com ${p.total} dias contabilizados.`
          : `Dia ${p.elapsed} de ${p.total}. Se o ritmo continuar, o mês fecha perto de ${money(
              p.projected
            )}. A média conta só o que varia; os fixos já entram inteiros na projeção.`}
      </p>
    </div>
  );
}

/* --------------------------- evolução --------------------------- */

function Trend({ tx, ym }: WidgetProps) {
  const data = lastMonths(ym, 6).map((m) => {
    const t = monthTotals(tx, m);
    return { ym: m, receitas: t.receitas, despesas: t.despesas };
  });
  const withData = data.filter((d) => d.despesas > 0);
  const avg = withData.length
    ? withData.reduce((s, d) => s + d.despesas, 0) / withData.length
    : 0;

  return (
    <div className="card span2">
      <Head
        icon="resumo"
        title="Evolução dos gastos"
        aside={<span className="tagsoft num">média {money(avg)}</span>}
      />
      <MonthBars data={data} mode="despesas" height={168} />
    </div>
  );
}

/* --------------------------- maiores --------------------------- */

function Top({ tx, ym, cats }: WidgetProps) {
  const rows = inMonth(tx, ym)
    .filter((t) => t.kind === "despesa")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const max = rows[0]?.amount ?? 1;

  return (
    <div className="card">
      <Head icon="arrowDownRight" title="Maiores gastos do mês" />
      {rows.length === 0 ? (
        <p className="dim">Sem despesas neste mês.</p>
      ) : (
        <ul className="ranklist">
          {rows.map((t) => (
            <li key={t.id}>
              <span className="emo">{findCategory(cats, t.category).emoji}</span>
              <span className="ranklist__txt">
                <strong>{t.description}</strong>
                <span className="dim">{findCategory(cats, t.category).label}</span>
              </span>
              <span className="num ranklist__v">{money(t.amount)}</span>
              <span className="ranklist__bar">
                <span style={{ width: `${(t.amount / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------ dias da semana ------------------------ */

function Weekday({ tx, ym }: WidgetProps) {
  return (
    <div className="card">
      <Head icon="calendar" title="Dias da semana" />
      <WeekdayBars data={byWeekday(tx, ym)} />
      <p className="dim">Só gasto variável: conta fixa é dia marcado, não é hábito.</p>
    </div>
  );
}

/* ------------------------ parcelamentos ------------------------ */

function Installments({ tx, ym, cats }: WidgetProps) {
  const rows = inMonth(tx, ym).filter((t) => t.installment);
  const remaining = rows.reduce(
    (s, t) => s + t.amount * (t.installment!.total - t.installment!.current),
    0
  );

  return (
    <div className="card">
      <Head
        icon="assinaturas"
        title="Parcelamentos em aberto"
        aside={remaining > 0 ? <span className="tagsoft num">falta {money(remaining)}</span> : null}
      />
      {rows.length === 0 ? (
        <p className="dim">Nenhuma parcela ativa neste mês.</p>
      ) : (
        <ul className="ranklist">
          {rows.map((t) => {
            const { current, total } = t.installment!;
            return (
              <li key={t.id}>
                <span className="emo">{findCategory(cats, t.category).emoji}</span>
                <span className="ranklist__txt">
                  <strong>{t.description}</strong>
                  <span className="dim">
                    parcela {current} de {total} · faltam {total - current}
                  </span>
                </span>
                <span className="num ranklist__v">{money(t.amount)}</span>
                <span className="ranklist__bar">
                  <span style={{ width: `${(current / total) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --------------------------- fixos --------------------------- */

function Fixed({ tx, ym, cats }: WidgetProps) {
  const rows = inMonth(tx, ym)
    .filter((t) => t.kind === "despesa" && t.recurrence === "fixo")
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="card">
      <Head
        icon="lock"
        title="Compromissos fixos"
        aside={<span className="tagsoft num">{money(total)}</span>}
      />
      {rows.length === 0 ? (
        <p className="dim">Nenhum gasto fixo neste mês.</p>
      ) : (
        <ul className="ranklist ranklist--plain">
          {rows.slice(0, 7).map((t) => (
            <li key={t.id}>
              <span className="emo">{findCategory(cats, t.category).emoji}</span>
              <span className="ranklist__txt">
                <strong>{t.description}</strong>
                <span className="dim">dia {t.date.slice(8, 10)}</span>
              </span>
              <span className="num ranklist__v">{money(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------- comparação ------------------------- */

function Compare({ tx, ym, cats }: WidgetProps) {
  const now = byCategory(tx, ym, cats);
  const before = byCategory(tx, shiftMonth(ym, -1), cats);
  const ids = [...new Set([...now.map((c) => c.id), ...before.map((c) => c.id)])];

  const deltas = ids
    .map((id) => {
      const a = now.find((c) => c.id === id);
      const b = before.find((c) => c.id === id);
      const cat = findCategory(cats, id);
      return {
        id,
        label: cat.label,
        emoji: cat.emoji,
        delta: (a?.total ?? 0) - (b?.total ?? 0),
      };
    })
    .filter((d) => Math.abs(d.delta) > 0.005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 6);

  return (
    <div className="card">
      <Head icon="arrowUpRight" title="Contra o mês passado" />
      {deltas.length === 0 ? (
        <p className="dim">Nada a comparar ainda.</p>
      ) : (
        <ul className="ranklist ranklist--plain">
          {deltas.map((d) => (
            <li key={d.id}>
              <span className="emo">{d.emoji}</span>
              <span className="ranklist__txt">
                <strong>{d.label}</strong>
              </span>
              <span className={`num ranklist__v ${d.delta > 0 ? "v-neg" : "v-pos"}`}>
                {d.delta > 0 ? "+" : "−"}
                {money(Math.abs(d.delta))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------- despacho -------------------------- */

export function HomeWidget({ id, ...props }: WidgetProps & { id: string }) {
  switch (id) {
    case "calendar":
      return <SpendCalendar tx={props.tx} ym={props.ym} today={props.today} cats={props.cats} />;
    case "categories":
      return <Categories {...props} />;
    case "split":
      return <Split {...props} />;
    case "pace":
      return <Pace {...props} />;
    case "trend":
      return <Trend {...props} />;
    case "top":
      return <Top {...props} />;
    case "weekday":
      return <Weekday {...props} />;
    case "installments":
      return <Installments {...props} />;
    case "fixed":
      return <Fixed {...props} />;
    case "compare":
      return <Compare {...props} />;
    default:
      return null;
  }
}

export { monthShort };
