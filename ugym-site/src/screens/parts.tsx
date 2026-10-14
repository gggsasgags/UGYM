import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { money, moneyCompact, monthLabel, monthShort } from "../lib/format";

/* ---------------- navegador de mês ---------------- */

export function MonthNav({
  ym,
  onChange,
}: {
  ym: string;
  onChange?: (delta: number) => void;
}) {
  return (
    <div className="mnav">
      <button className="mnav__btn" aria-label="Mês anterior" onClick={() => onChange?.(-1)}>
        <Icon name="chevronLeft" size={18} />
      </button>
      <span className="mnav__label">{monthLabel(ym)}</span>
      <button className="mnav__btn" aria-label="Próximo mês" onClick={() => onChange?.(1)}>
        <Icon name="chevronRight" size={18} />
      </button>
    </div>
  );
}

/* ---------------- rosca ---------------- */

export interface Slice {
  label: string;
  value: number;
  color: string;
  /** quando informado, a fatia vira alvo de toque e abre o detalhe */
  onClick?: () => void;
}

export function Donut({
  slices,
  size = 168,
  thickness = 26,
  caption,
  total,
  ofTotal,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  caption: string;
  total: number;
  /** quando informado, as fatias são medidas contra este valor */
  ofTotal?: number;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const sum = (ofTotal ?? slices.reduce((s, x) => s + x.value, 0)) || 1;
  let offset = 0;

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden={slices.every((s) => !s.onClick)}
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--canvas-2)"
            strokeWidth={thickness}
          />
          {slices.map((s) => {
            const len = (s.value / sum) * c;
            // 2px de respiro entre fatias, conforme a anatomia de marca
            const dash = `${Math.max(len - 2, 0)} ${c - Math.max(len - 2, 0)}`;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
                className={s.onClick ? "donut__fatia" : undefined}
                /* A fatia é decoração enquanto não faz nada; com onClick ela
                   vira um botão de verdade, com nome e foco de teclado. */
                role={s.onClick ? "button" : undefined}
                tabIndex={s.onClick ? 0 : undefined}
                aria-label={s.onClick ? `${s.label}: ${money(s.value)}` : undefined}
                onClick={s.onClick}
                onKeyDown={
                  s.onClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          s.onClick?.();
                        }
                      }
                    : undefined
                }
              />
            );
            offset += len;
            return el;
          })}
        </g>
      </svg>
      <div className="donut__center">
        {/* sem legenda, o valor fica sozinho e centrado de verdade */}
        {caption && <span className="donut__cap">{caption}</span>}
        <span className="donut__val num">{money(total)}</span>
      </div>
    </div>
  );
}

/* ---------------- anel da nota ---------------- */

export function ScoreRing({ value, size = 58 }: { value: number; size?: number }) {
  const t = 6;
  const r = (size - t) / 2;
  const c = 2 * Math.PI * r;
  const filled = (value / 10) * c;
  const tone = value >= 5 ? "var(--pos)" : "var(--neg)";
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--canvas-2)" strokeWidth={t} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={t}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontFamily: "var(--f-display)",
          fontWeight: 600,
          fontSize: size * 0.31,
          letterSpacing: "-0.03em",
        }}
      >
        {value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </span>
    </div>
  );
}


/* mede a largura real do contêiner para desenhar em pixels, não em escala */
function useWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const next = Math.round(e.contentRect.width);
      if (next > 0) setW(next);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/* ---------------- gráfico mensal: barras ou linhas ---------------- */

export type BarMode = "receitas" | "misto" | "despesas";
export type ChartShape = "barras" | "linha";

interface MonthPoint {
  ym: string;
  receitas: number;
  despesas: number;
}

const SERIES: Record<BarMode, [key: "receitas" | "despesas", color: string][]> = {
  misto: [
    ["receitas", "var(--pos)"],
    ["despesas", "var(--bar-2)"],
  ],
  receitas: [["receitas", "var(--pos)"]],
  despesas: [["despesas", "var(--bar-2)"]],
};

export function MonthChart({
  data,
  mode,
  shape = "barras",
  height = 210,
}: {
  data: MonthPoint[];
  mode: BarMode;
  shape?: ChartShape;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, w] = useWidth<HTMLDivElement>(320);

  const padB = 26;
  const padT = 10;
  const plot = height - padB - padT;
  const series = SERIES[mode];

  const max =
    Math.max(1, ...data.flatMap((d) => series.map(([k]) => d[k]))) * 1.15;
  const slot = w / Math.max(1, data.length);
  const y = (v: number) => height - padB - (v / max) * plot;

  const gap = 4;
  /* Barra fina é o que separa gráfico de bloco de cor. O teto caiu junto
     com o resto do Resumo, que estava um degrau mais grosso que o app. */
  const bw = Math.max(
    5,
    Math.min(series.length === 2 ? 12 : 20, (slot - 18) / series.length - gap)
  );
  const groupW = series.length * bw + (series.length - 1) * gap;

  return (
    <div className="chartwrap" ref={box}>
      <svg
        className="chart"
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        role="img"
        aria-label={`Evolução de ${mode} nos últimos ${data.length} meses`}
        onMouseLeave={() => setHover(null)}
      >
        {shape === "linha" &&
          series.map(([key, color]) => {
            const pts = data.map((d, i) => [slot * i + slot / 2, y(d[key])] as const);
            const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]} ${p[1]}`).join(" ");
            const area = `${line} L${pts[pts.length - 1][0]} ${height - padB} L${pts[0][0]} ${
              height - padB
            } Z`;
            return (
              <g key={key}>
                <path d={area} fill={color} opacity={0.08} />
                <path
                  d={line}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p[0]}
                    cy={p[1]}
                    r={hover === i ? 4.5 : 3}
                    fill="var(--paper)"
                    stroke={color}
                    strokeWidth={2}
                  />
                ))}
              </g>
            );
          })}

        {data.map((d, i) => {
          const cx = slot * i + slot / 2;
          return (
            <g key={d.ym} className="barg" onMouseEnter={() => setHover(i)}>
              <rect x={slot * i} y={0} width={slot} height={height} fill="transparent" />
              {shape === "barras" &&
                series.map(([key, color], si) => {
                  const v = d[key];
                  const h = height - padB - y(v);
                  return (
                    <rect
                      key={key}
                      className="bar"
                      x={cx - groupW / 2 + si * (bw + gap)}
                      y={y(v)}
                      width={bw}
                      height={Math.max(h, v > 0 ? 3 : 0)}
                      rx={4}
                      fill={color}
                    />
                  );
                })}
              <text
                x={cx}
                y={height - 8}
                textAnchor="middle"
                fontSize={11}
                fill="var(--tx-2)"
                style={{ textTransform: "capitalize" }}
              >
                {monthShort(d.ym)}
              </text>
            </g>
          );
        })}
      </svg>

      {hover !== null && data[hover] && (
        <div className="ctip" style={{ left: `${((slot * hover + slot / 2) / w) * 100}%`, top: 46 }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>{monthLabel(data[hover].ym)}</div>
          {series.map(([key, color]) => (
            <div className="ctip__k" key={key}>
              <i className="ctip__sw" style={{ background: color }} />
              <span style={{ textTransform: "capitalize" }}>{key}</span>
              <span className="num" style={{ marginLeft: 6, fontWeight: 600 }}>
                {money(data[hover][key])}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="chlegend">
        {series.map(([key, color]) => (
          <span key={key}>
            <i style={{ background: color }} />
            <span style={{ textTransform: "capitalize" }}>{key}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** compatibilidade com os blocos da tela inicial */
export function MonthBars({
  data,
  mode,
  height = 168,
}: {
  data: MonthPoint[];
  mode: BarMode;
  height?: number;
}) {
  return <MonthChart data={data} mode={mode} height={height} />;
}

/* ---------------- barras por dia da semana ---------------- */

export function WeekdayBars({ data }: { data: { day: string; total: number }[] }) {
  const [box, w] = useWidth<HTMLDivElement>(320);
  const h = 132;
  const padB = 20;
  const max = Math.max(1, ...data.map((d) => d.total));
  const slot = w / data.length;
  const peak = data.reduce((a, b) => (b.total > a.total ? b : a), data[0]);

  const bw = Math.max(14, Math.min(34, slot - 10));

  return (
    <div className="chartwrap" ref={box}>
    <svg
      className="chart"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Gastos por dia da semana"
    >
      {data.map((d, i) => {
        const bh = (d.total / max) * (h - padB - 20);
        const x = slot * i + slot / 2 - bw / 2;
        const isPeak = d.day === peak.day && d.total > 0;
        return (
          <g key={d.day}>
            <rect
              x={x}
              y={h - padB - bh}
              width={bw}
              height={Math.max(bh, d.total > 0 ? 3 : 0)}
              rx={4}
              fill={isPeak ? "var(--pos)" : "var(--line-2)"}
            />
            {isPeak && (
              <text
                x={x + bw / 2}
                y={h - padB - bh - 6}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="var(--pos)"
              >
                {moneyCompact(d.total)}
              </text>
            )}
            <text x={x + bw / 2} y={h - 6} textAnchor="middle" fontSize={10} fill="var(--tx-2)">
              {d.day}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}
