import { useMemo, useState } from "react";
import { findCategory } from "../lib/categories";
import { money, signed } from "../lib/format";
import { dailySpend } from "../lib/analytics";
import type { Category, Transaction } from "../lib/types";
import { Icon } from "./Icon";

const WD = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Calendário de calor do mês: o dia acende em verde quando houve gasto,
 * mais forte quanto maior o valor. Tocar em um dia abre o que caiu nele.
 */
export function SpendCalendar({
  tx,
  ym,
  today,
  cats,
}: {
  tx: Transaction[];
  ym: string;
  today?: string;
  cats: Category[];
}) {
  const [picked, setPicked] = useState<number | null>(null);

  const days = useMemo(() => dailySpend(tx, ym), [tx, ym]);
  const max = Math.max(1, ...days.map((d) => d.total));
  const total = days.reduce((s, d) => s + d.total, 0);
  const active = days.filter((d) => d.total > 0).length;

  const [y, m] = ym.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();

  const rows = useMemo(
    () =>
      picked
        ? tx
            .filter((t) => t.date === `${ym}-${String(picked).padStart(2, "0")}`)
            .sort((a, b) => b.amount - a.amount)
        : [],
    [tx, ym, picked]
  );

  const pickedTotal = rows
    .filter((t) => t.kind === "despesa")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <div className="card cal">
      <div className="card__head">
        <span className="card__title">
          <Icon name="calendar" size={15} />
          Calendário de gastos
        </span>
        <span className="tagsoft">
          {active} {active === 1 ? "dia" : "dias"} com gasto
        </span>
      </div>

      <div className="cal__grid" role="grid" aria-label="Calendário de gastos do mês">
        {WD.map((d, i) => (
          <span className="cal__wd" key={i} aria-hidden="true">
            {d}
          </span>
        ))}

        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}

        {days.map((d) => {
          const ratio = d.total / max;
          const lit = d.total > 0;
          const isToday = today === `${ym}-${String(d.day).padStart(2, "0")}`;
          const alpha = lit ? 0.12 + 0.88 * Math.pow(ratio, 0.6) : 0;
          return (
            <button
              key={d.day}
              className="cal__day"
              data-lit={lit}
              data-strong={alpha > 0.55}
              data-on={picked === d.day}
              data-today={isToday}
              aria-label={
                lit
                  ? `Dia ${d.day}, ${money(d.total)} em ${d.count} ${
                      d.count === 1 ? "lançamento" : "lançamentos"
                    }`
                  : `Dia ${d.day}, sem gastos`
              }
              onClick={() => setPicked((p) => (p === d.day ? null : d.day))}
              style={
                lit
                  ? {
                      background: `rgba(10, 127, 44, ${alpha.toFixed(3)})`,
                      boxShadow:
                        ratio > 0.55
                          ? `0 3px 14px -4px rgba(10,127,44,${(ratio * 0.65).toFixed(2)})`
                          : undefined,
                    }
                  : undefined
              }
            >
              {d.day}
            </button>
          );
        })}
      </div>

      <div className="cal__scale">
        <span>menos</span>
        <i style={{ background: "rgba(10,127,44,0.14)" }} />
        <i style={{ background: "rgba(10,127,44,0.38)" }} />
        <i style={{ background: "rgba(10,127,44,0.64)" }} />
        <i style={{ background: "rgba(10,127,44,0.95)" }} />
        <span>mais</span>
        {total > 0 && <span className="cal__scalev num">{money(max)} no maior dia</span>}
      </div>

      {picked !== null && (
        <div className="cal__detail">
          <div className="cal__detailhead">
            <strong>
              Dia {picked}
              {rows.length ? ` · ${money(pickedTotal)}` : ""}
            </strong>
            <button onClick={() => setPicked(null)} aria-label="Fechar detalhe do dia">
              <Icon name="close" size={15} />
            </button>
          </div>

          {rows.length === 0 ? (
            <p className="dim">Nenhum lançamento neste dia.</p>
          ) : (
            <ul className="cal__list">
              {rows.map((t) => (
                <li key={t.id}>
                  <span className="emo">{findCategory(cats, t.category).emoji}</span>
                  <span className="cal__desc">{t.description}</span>
                  <span className={`num ${t.kind === "movimentacao" ? "dim" : t.kind === "despesa" ? "v-neg" : "v-pos"}`}>
                    {signed(t.amount, t.kind)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {total === 0 && <p className="dim" style={{ marginTop: 12 }}>Nenhum gasto registrado neste mês ainda.</p>}
    </div>
  );
}
