import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { Foto } from "../components/Foto";
import { ShareCard } from "../components/ShareCard";
import { findCategory } from "../lib/categories";
import {
  byCategory,
  byWeekday,
  categoryMatrix,
  monthReport,
  monthTotals,
  splitRecurrence,
} from "../lib/analytics";
import { parseStatement, type ImportResult } from "../lib/statements";
import {
  dayLabel,
  lastMonths,
  monthsRange,
  shiftMonth,
  money,
  monthLabel,
  monthShort,
  pct,
  signed,
  todayYM,
} from "../lib/format";
import { temMarcaDeParcela } from "../lib/parcelas";
import type { Account, Category, Transaction } from "../lib/types";
import {
  Donut,
  MonthChart,
  MonthNav,
  ScoreRing,
  WeekdayBars,
  type BarMode,
  type ChartShape,
} from "./parts";
import { HomeGrid } from "./HomeGrid";
import "./screens.css";

export interface ScreenProps {
  tx: Transaction[];
  ym: string;
  cats: Category[];
  account?: Account | null;
  home?: string[];
  today?: string;
  onMonth?: (delta: number) => void;
  onAdd?: () => void;
  onEdit?: (tx: Transaction) => void;
  onRemove?: (id: string) => void;
  onClearMonth?: () => void;
  onCategories?: () => void;
  onCustomize?: () => void;
  onReorder?: (ids: string[]) => void;
  /** total exibido no cartão do topo, só usado pela animação do site */
  totalShown?: number;
  onRemoveWidget?: (id: string) => void;
  onImport?: (result: ImportResult) => void;
  /** abre a gaveta lateral; só a aba Início mostra esse botão */
  onMenu?: () => void;
  /** abre a folha que escolhe os meses antes de baixar a planilha */
  onExport?: () => void;
  onProfile?: () => void;
}

/* ------------------------------------------------------------------
   Modo privacidade da tela inicial.

   É o olhinho dos aplicativos de banco: some com os valores para quem
   está ao lado não ler a tela. A escolha fica no próprio aparelho, e
   não na conta, porque esconder é uma decisão do lugar onde você está,
   não de quem você é: faz sentido ficar escondido no celular do bolso
   e visível no computador de casa.

   Fechar o aplicativo não desliga: só o olhinho desliga.
-------------------------------------------------------------------*/
const CHAVE_PRIVACIDADE = "gasto:valores-ocultos";

function usePrivacidade(): [boolean, (v: boolean) => void] {
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_PRIVACIDADE) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE_PRIVACIDADE, oculto ? "1" : "0");
    } catch {
      /* navegador anônimo ou armazenamento bloqueado: segue sem lembrar */
    }
  }, [oculto]);

  return [oculto, setOculto];
}

/* ══════════════════════════ Início ══════════════════════════ */

export function HomeScreen({
  tx,
  ym,
  cats,
  account,
  home = [],
  today,
  onMonth,
  onCustomize,
  onReorder,
  onRemoveWidget,
  totalShown,
  onMenu,
  onProfile,
}: ScreenProps) {
  const [share, setShare] = useState(false);
  const [oculto, setOculto] = usePrivacidade();
  const t = monthTotals(tx, ym);
  const split = splitRecurrence(tx, ym);
  const report = monthReport(tx, ym, cats);
  const name = account?.name ?? "Você";
  /* Mês que ainda não chegou tem lançamento marcado, mas não tem nota nem
     gasto: ninguém gastou nada em dezembro ainda. O que muda aqui é só o
     rótulo, para o número não ser lido como dinheiro que já saiu. */
  const futuro = ym > todayYM();

  return (
    <div className="scr scr--home" data-oculto={oculto || undefined}>
      <div className="hello">
        {/* O menu mora no canto de cima à esquerda, colado na foto, que é
            onde a mão procura ele em qualquer aplicativo. */}
        {onMenu && (
          <button className="scr__tool hello__menu" onClick={onMenu} aria-label="Abrir menu">
            <Icon name="menu" size={19} />
          </button>
        )}
        {onProfile ? (
          <button className="hello__avbtn" onClick={onProfile} aria-label="Seu perfil">
            <Foto
              src={account?.avatar}
              letra={name.charAt(0).toUpperCase()}
              className="hello__av hello__av--img"
              classNameLetra="hello__av"
            />
          </button>
        ) : (
          <Foto
            src={account?.avatar}
            letra={name.charAt(0).toUpperCase()}
            className="hello__av hello__av--img"
            classNameLetra="hello__av"
          />
        )}
        <div className="hello__id">
          <div className="hello__name">Olá, {name}</div>
          {futuro ? (
            <span className="hello__meta hello__meta--futuro">
              <span className="hello__dot" />
              {monthLabel(ym)} ainda não chegou
            </span>
          ) : (
            <button className="hello__meta" onClick={() => setShare(true)}>
              <span className="hello__dot" />
              {report.tier} · nota{" "}
              {report.score.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
              <Icon name="arrowUpRight" size={12} />
            </button>
          )}
        </div>
      </div>

      <MonthNav ym={ym} onChange={onMonth} />

      <div className="scr__body">
        <div className="hero span2">
          <div className="hero__glow" aria-hidden="true" />
          <div className="hero__label">
            <Icon name={futuro ? "calendar" : "arrowDownRight"} size={14} />
            {futuro ? "Já marcado para o mês" : "Total gasto no mês"}
            <button
              type="button"
              className="hero__eye"
              onClick={() => setOculto(!oculto)}
              aria-pressed={oculto}
              aria-label={oculto ? "Mostrar os valores" : "Esconder os valores"}
              title={oculto ? "Mostrar os valores" : "Esconder os valores"}
            >
              <Icon name={oculto ? "eyeOff" : "eye"} size={17} />
            </button>
          </div>
          <div className="hero__value num" aria-live="polite">
            {oculto ? (
              <span className="hero__oculto" aria-label="Valor escondido">
                R$ <i /> <i /> <i />
              </span>
            ) : (
              money(totalShown ?? split.total)
            )}
          </div>
          <div className="hero__chips">
            <span>
              <Icon name="lancamentos" size={13} />
              {t.count} {t.count === 1 ? "lançamento" : "lançamentos"}
            </span>
          </div>
        </div>

        <HomeGrid
          ids={home}
          tx={tx}
          ym={ym}
          cats={cats}
          today={today}
          onReorder={onReorder}
          onRemove={onRemoveWidget}
          onAdd={onCustomize}
        />
      </div>

      {share && (
        <ShareCard
          account={account ?? null}
          score={report.score}
          tier={report.tier}
          ym={ym}
          onClose={() => setShare(false)}
        />
      )}
    </div>
  );
}

/* ══════════════════════ Lançamentos ══════════════════════ */

type SortKey = "data" | "valor" | "descricao";

export function TransactionsScreen({
  tx,
  ym,
  cats,
  onMonth,
  onAdd,
  onEdit,
  onRemove,
  onClearMonth,
  onCategories,
  onImport,
  onExport,
}: ScreenProps) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("todas");
  const [rec, setRec] = useState<"todos" | "fixo" | "variavel">("todos");
  const [sort, setSort] = useState<SortKey>("data");
  const [openFilters, setOpenFilters] = useState(false);
  const [arquivo, setArquivo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const monthRows = useMemo(() => tx.filter((t) => t.date.startsWith(ym)), [tx, ym]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = monthRows.filter((t) => {
      if (cat !== "todas" && t.category !== cat) return false;
      /* Filtrar por fixo ou variável é filtrar gasto: recebimento não
         entra em nenhum dos dois, então sai da lista junto. */
      if (rec !== "todos" && (t.kind !== "despesa" || t.recurrence !== rec)) return false;
      if (!needle) return true;
      return (
        t.description.toLowerCase().includes(needle) ||
        findCategory(cats, t.category).label.toLowerCase().includes(needle) ||
        t.amount.toFixed(2).replace(".", ",").includes(needle) ||
        dayLabel(t.date).includes(needle) ||
        t.date.split("-").reverse().join("/").includes(needle)
      );
    });
    return out.sort((a, b) =>
      sort === "valor"
        ? b.amount - a.amount
        : sort === "descricao"
        ? a.description.localeCompare(b.description, "pt-BR")
        : b.date.localeCompare(a.date)
    );
  }, [monthRows, q, cat, rec, sort, cats]);

  const usedCats = useMemo(
    () => cats.filter((c) => monthRows.some((t) => t.category === c.id)),
    [cats, monthRows]
  );

  const shown = rows.filter((t) => t.kind === "despesa").reduce((s, t) => s + t.amount, 0);
  const filtered = cat !== "todas" || rec !== "todos" || q.trim().length > 0;

  const [reading, setReading] = useState(false);
  const pickFile = async (file: File) => {
    setReading(true);
    const result = await parseStatement(file, cats);
    setReading(false);
    onImport?.(result);
  };

  return (
    <div className="scr">
      <div className="scr__top scr__top--acoes">
        <span className="scr__title">Lançamentos</span>
        <div className="scr__tools">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xls,.xlsx,.pdf,text/csv,application/pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pickFile(f);
              e.target.value = "";
            }}
          />
          {/* Um botão só: importar e exportar são a mesma ideia, arquivo
              entrando ou saindo, e dois ícones parecidos lado a lado
              faziam a pessoa parar para decidir qual seta era qual. */}
          <div className="arqbox">
            <button
              className="scr__tool"
              aria-label="Importar ou exportar"
              title="Importar extrato ou exportar planilha"
              data-on={reading || arquivo}
              aria-expanded={arquivo}
              onClick={() => setArquivo((a) => !a)}
            >
              <Icon name={reading ? "assinaturas" : "arquivo"} size={17} />
            </button>

            {arquivo && (
              <>
                <button
                  className="menu__catch"
                  aria-label="Fechar"
                  onClick={() => setArquivo(false)}
                />
                <div className="arqmenu" role="menu">
                  <button
                    className="arqmenu__i"
                    role="menuitem"
                    onClick={() => {
                      setArquivo(false);
                      fileRef.current?.click();
                    }}
                  >
                    <Icon name="upload" size={15} />
                    Importar extrato
                  </button>
                  <button
                    className="arqmenu__i"
                    role="menuitem"
                    disabled={!tx.length}
                    title={tx.length ? undefined : "Nada para exportar ainda"}
                    onClick={() => {
                      setArquivo(false);
                      onExport?.();
                    }}
                  >
                    <Icon name="download" size={15} />
                    Exportar planilha
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            className="scr__tool"
            aria-label="Gerenciar categorias"
            title="Categorias"
            onClick={onCategories}
          >
            <Icon name="tag" size={17} />
          </button>
          <button
            className="scr__tool"
            aria-label="Filtros"
            aria-expanded={openFilters}
            data-on={openFilters || filtered}
            onClick={() => setOpenFilters((o) => !o)}
          >
            <Icon name="filter" size={17} />
          </button>
        </div>

        {/* Sozinho e empurrado para a direita: é a ação principal da tela,
            e não mais um ícone da fileira. */}
        <button className="btn btn--pos btn--sm scr__add" onClick={onAdd}>
          <Icon name="plus" size={15} />
          Adicionar
        </button>
      </div>

      <MonthNav ym={ym} onChange={onMonth} />

      <div className="scr__body">
        <div className="toolrow span2">
          <label className="search">
            <Icon name="search" size={16} />
            <input
              id="busca-lancamentos"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por descrição, valor ou data"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Limpar busca">
                <Icon name="close" size={14} />
              </button>
            )}
          </label>
          <button className="rowlink" onClick={onClearMonth}>
            Apagar todos do mês
          </button>
        </div>

        {(openFilters || filtered) && (
          <div className="filters span2">
            <label className="fsel">
              <span>Categoria</span>
              <select id="f-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="todas">Todas</option>
                {usedCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="fsel">
              <span>Recorrência</span>
              <select id="f-rec" value={rec} onChange={(e) => setRec(e.target.value as typeof rec)}>
                <option value="todos">Todos</option>
                <option value="fixo">Só gastos fixos</option>
                <option value="variavel">Só gastos variáveis</option>
              </select>
            </label>

            <label className="fsel">
              <span>Ordenar por</span>
              <select id="f-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                <option value="data">Data, mais recente</option>
                <option value="valor">Valor, maior primeiro</option>
                <option value="descricao">Descrição, A a Z</option>
              </select>
            </label>

            {filtered && (
              <div className="filters__sum">
                <span>
                  {rows.length} {rows.length === 1 ? "lançamento" : "lançamentos"} ·{" "}
                  <strong className="num">{money(shown)}</strong>
                </span>
                <button
                  onClick={() => {
                    setCat("todas");
                    setRec("todos");
                    setQ("");
                  }}
                >
                  Limpar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="empty span2">
            {monthRows.length === 0 ? (
              <>
                Nenhum lançamento neste mês.
                <br />
                Toque em <strong>Adicionar</strong> para registrar o primeiro, ou importe um
                extrato pelo ícone de seta para cima.
              </>
            ) : (
              <>Nenhum lançamento corresponde ao que você filtrou.</>
            )}
          </div>
        ) : (
          <div className="tlist span2">
            {rows.map((t) => {
              const cd = findCategory(cats, t.category);
              return (
                <div className="trow" key={t.id}>
                  <button
                    className="trow__main"
                    onClick={() => onEdit?.(t)}
                    aria-label={`Editar ${t.description}`}
                  >
                    <span className="trow__ic">{cd.emoji}</span>
                    <span className="trow__txt">
                      {/* O número da parcela só entra quando a descrição
                          ainda não tem um. Lançamentos antigos, e os que
                          vieram de importação de extrato, costumam trazer
                          "5 de 6" escrito, e o app somava o dele por cima:
                          "revisão do carro 5 de 6 1/2". */}
                      <span className="trow__desc">
                        {t.description}
                        {t.installment && !temMarcaDeParcela(t.description)
                          ? ` ${t.installment.current}/${t.installment.total}`
                          : ""}
                      </span>
                      <span className="trow__meta">
                        <span className="num">{dayLabel(t.date)}</span>
                        <span>·</span>
                        <span>{cd.label}</span>
                        {/* só despesa tem fixo e variável */}
                        {t.kind === "despesa" && (
                          <span
                            className={`chip chip--${t.recurrence === "fixo" ? "fixo" : "var"}`}
                          >
                            {t.recurrence === "fixo" ? "Fixo" : "Variável"}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className={`trow__val num ${t.kind === "movimentacao" ? "dim" : t.kind === "despesa" ? "v-neg" : "v-pos"}`}>
                      {signed(t.amount, t.kind)}
                    </span>
                  </button>
                  {onRemove && (
                    <button
                      className="scr__tool trow__del"
                      aria-label={`Apagar ${t.description}`}
                      onClick={() => onRemove(t.id)}
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════ Resumo ════════════════════════ */

const RANGES = [3, 6, 9, 12] as const;

/* Receitas menos despesas, escrito como resultado e não como valor solto:
   o sinal na frente é o que diz, num relance, de que lado o mês fechou.
   O traço simples é o mesmo que o resto do aplicativo usa. O zero fica
   sem sinal, porque "+R$ 0,00" não quer dizer nada. */
const resultado = (v: number) => (v > 0 ? "+" : v < 0 ? "-" : "") + money(Math.abs(v));

export function SummaryScreen({ tx, ym, cats }: ScreenProps) {
  const [range, setRange] = useState<number | "custom">(6);
  const [from, setFrom] = useState(shiftMonth(ym, -5));
  const [to, setTo] = useState(ym);
  const [mode, setMode] = useState<BarMode>("misto");
  const [shape, setShape] = useState<ChartShape>("barras");
  const [view, setView] = useState<"geral" | "planilha">("geral");

  const months = range === "custom" ? monthsRange(from, to) : lastMonths(ym, range);

  const data = months.map((m) => {
    const t = monthTotals(tx, m);
    return { ym: m, receitas: t.receitas, despesas: t.despesas, hasData: t.hasData };
  });

  const key: "receitas" | "despesas" = mode === "receitas" ? "receitas" : "despesas";
  const withData = data.filter((d) => d.hasData);
  const avg = (k: "receitas" | "despesas") =>
    withData.length ? withData.reduce((s, d) => s + d[k], 0) / withData.length : 0;
  const sum = (k: "receitas" | "despesas") => data.reduce((s, d) => s + d[k], 0);
  /* O número de cada mês na fileira de baixo é o do botão escolhido. Em
     misto não existe "o" número do mês, existem dois, então o que vale
     ali é a diferença: o que entrou menos o que saiu. */
  const valorDoMes = (d: { receitas: number; despesas: number }) =>
    mode === "misto" ? d.receitas - d.despesas : d[key];
  const maxCell = Math.max(1, ...data.map((d) => Math.abs(valorDoMes(d))));

  const corDoMes = (temDado: boolean, v: number) => {
    if (!temDado) return "var(--tx-3)";
    if (mode === "receitas") return "var(--pos)";
    if (mode === "despesas") return "var(--tx-1)";
    return v > 0 ? "var(--pos)" : v < 0 ? "var(--neg)" : "var(--tx-1)";
  };
  const corDaBarra = (v: number) => {
    if (mode === "receitas") return "var(--pos)";
    if (mode === "despesas") return "var(--ink)";
    return v < 0 ? "var(--neg)" : "var(--pos)";
  };

  const matrix = categoryMatrix(tx, months, cats, mode === "receitas" ? "receita" : "despesa");

  const chartTitle =
    mode === "misto"
      ? "Receitas e despesas"
      : mode === "receitas"
      ? "Receitas do período"
      : "Despesas do período";

  return (
    <div className={`scr scr--summary${view === "planilha" ? " scr--sheet" : ""}`}>
      <div className="scr__top">
        <span className="scr__title">
          <Icon name="resumo" size={18} />
          Resumo
        </span>
      </div>

      <div className="scr__body">
        <div className="seg span2" role="tablist">
          <button
            className="seg__i"
            role="tab"
            aria-selected={view === "geral"}
            onClick={() => setView("geral")}
          >
            Geral
          </button>
          <button
            className="seg__i"
            role="tab"
            aria-selected={view === "planilha"}
            onClick={() => setView("planilha")}
          >
            Modo planilha
          </button>
        </div>

        <div className="seg seg--soft span2" role="tablist">
          {RANGES.map((n) => (
            <button
              key={n}
              className="seg__i"
              role="tab"
              aria-selected={range === n}
              onClick={() => setRange(n)}
            >
              {n}m
            </button>
          ))}
          <button
            className="seg__i"
            role="tab"
            aria-selected={range === "custom"}
            onClick={() => setRange("custom")}
          >
            Custom
          </button>
        </div>

        {range === "custom" && (
          <div className="rangepick span2">
            <label className="fsel">
              <span>De</span>
              <input
                id="rg-de"
                type="month"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value || from)}
              />
            </label>
            <label className="fsel">
              <span>Até</span>
              <input
                id="rg-ate"
                type="month"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value || to)}
              />
            </label>
            <span className="tagsoft num">{months.length} meses</span>
          </div>
        )}

        <div className="seg seg--ink span2" role="tablist">
          {(["receitas", "misto", "despesas"] as BarMode[]).map((m) => (
            <button
              key={m}
              className="seg__i"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              style={{ textTransform: "capitalize" }}
            >
              {m}
            </button>
          ))}
        </div>

        {view === "geral" ? (
          <>
            <div className="card card--chart span2">
              <div className="card__head">
                <span className="card__t2">{chartTitle}</span>
                <div className="chtoggle">
                  <button
                    aria-pressed={shape === "barras"}
                    aria-label="Ver em barras"
                    onClick={() => setShape("barras")}
                  >
                    <Icon name="resumo" size={16} />
                  </button>
                  <button
                    aria-pressed={shape === "linha"}
                    aria-label="Ver em linha"
                    onClick={() => setShape("linha")}
                  >
                    <Icon name="investimentos" size={16} />
                  </button>
                </div>
              </div>
              <MonthChart data={data} mode={mode} shape={shape} height={214} />
            </div>

            <div className="stat2 span2">
              {mode !== "despesas" && (
                <div className="stat stat--pos">
                  <div className="stat__l">Média receitas</div>
                  <div className="stat__v num">{money(avg("receitas"))}</div>
                  {mode === "receitas" && (
                    <div className="stat__f num">total {money(sum("receitas"))}</div>
                  )}
                </div>
              )}
              {mode !== "receitas" && (
                <div className="stat stat--neg">
                  <div className="stat__l">Média despesas</div>
                  <div className="stat__v num">{money(avg("despesas"))}</div>
                  {mode === "despesas" && (
                    <div className="stat__f num">total {money(sum("despesas"))}</div>
                  )}
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------
                A fileira de meses segue o botão escolhido: em Receitas
                mostra o que entrou, em Despesas o que saiu, e em Misto a
                diferença entre os dois, com sinal e cor. É a única
                resposta possível ali: no modo misto o mês tem dois
                números, e mostrar um só seria escolher por quem lê.

                A barra mede o tamanho do resultado, não o lado dele, por
                isso ela usa o módulo. O maior mês, para cima ou para
                baixo, é quem dá a régua.
            ---------------------------------------------------------- */}
            <div className="mgrid mgrid--sum span2">
              {data.map((d) => {
                const v = valorDoMes(d);
                return (
                  <div key={d.ym} className={`mcell mcell--sum${d.ym === ym ? " mcell--on" : ""}`}>
                    <div className="mcell__m">{monthShort(d.ym)}</div>
                    <div className="mcell__v num" style={{ color: corDoMes(d.hasData, v) }}>
                      {d.hasData ? (mode === "misto" ? resultado(v) : money(v)) : "—"}
                    </div>
                    <span className="mcell__bar">
                      <span
                        style={{
                          width: `${(Math.abs(v) / maxCell) * 100}%`,
                          background: corDaBarra(v),
                        }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="card card--flush span2">
            <div className="sheetbar">
              <span className="dim">← deslize para navegar →</span>
              <span className="sheetbar__scale">
                <i style={{ background: "rgba(10,127,44,0.12)" }} />
                <i style={{ background: "rgba(10,127,44,0.34)" }} />
                <i style={{ background: "rgba(10,127,44,0.58)" }} />
                <i style={{ background: "rgba(10,127,44,0.9)" }} />
                menos → mais
              </span>
            </div>

            <div className="sheetwrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th className="grid__cat">Categoria</th>
                    {months.map((m) => (
                      <th key={m} className={m === ym ? "grid__now" : undefined}>
                        {monthShort(m)}/{m.slice(2, 4)}
                      </th>
                    ))}
                    <th className="grid__tot">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((r) => (
                    <tr key={r.id}>
                      <th className="grid__cat">
                        <span className="emo">{r.emoji}</span>
                        {r.label}
                      </th>
                      {r.values.map((v, i) => {
                        const a = v > 0 ? 0.1 + 0.85 * Math.pow(v / matrix.max, 0.6) : 0;
                        return (
                          <td
                            key={i}
                            data-strong={a > 0.55}
                            style={v > 0 ? { background: `rgba(10,127,44,${a.toFixed(3)})` } : undefined}
                          >
                            {v > 0 ? money(v) : "—"}
                          </td>
                        );
                      })}
                      <td className="grid__tot num">{money(r.total)}</td>
                    </tr>
                  ))}
                  <tr className="grid__sum">
                    <th className="grid__cat">Total do mês</th>
                    {matrix.columnTotals.map((v, i) => (
                      <td key={i} className="num">
                        {v > 0 ? money(v) : "—"}
                      </td>
                    ))}
                    <td className="grid__tot num">{money(matrix.grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {matrix.rows.length === 0 && (
              <p className="dim" style={{ padding: 16 }}>
                Sem lançamentos no período escolhido.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════ Análises ═══════════════════════ */

export function InsightsScreen({ tx, ym, cats, onMonth }: ScreenProps) {
  const [open, setOpen] = useState(false);
  const report = monthReport(tx, ym, cats);
  const slices = byCategory(tx, ym, cats);
  const week = byWeekday(tx, ym);
  const split = splitRecurrence(tx, ym);
  const totals = monthTotals(tx, ym);
  const maxCat = slices[0]?.total ?? 1;
  const isCurrent = ym === todayYM();

  /* ------------------------------------------------------------------
     Mês que ainda não chegou.

     Desde que parcelamento e fixo com fim passaram a nascer inteiros, dá
     para andar para a frente e encontrar o que já está comprometido. Só
     que nota de mês que não aconteceu é mentira: um dezembro com o
     salário lançado e nenhuma despesa daria dez, porque a conta é quanto
     da renda virou gasto, e ninguém gastou ainda. Então aqui o mês
     futuro mostra o que está marcado e mais nada.
  ------------------------------------------------------------------ */
  if (ym > todayYM()) {
    const marcado: [string, number, string][] = [
      ["Entradas", totals.receitas, "var(--pos)"],
      ["Fixos", split.fixo, "var(--ink)"],
      ["Parcelas e variáveis", split.variavel, "var(--neg)"],
    ];
    return (
      <div className="scr">
        <div className="scr__top">
          <span className="scr__title">
            <Icon name="analises" size={18} />
            Análises
          </span>
        </div>

        <MonthNav ym={ym} onChange={onMonth} />

        <div className="scr__body">
          <div className="banner span2">
            <Icon name="calendar" size={15} />
            <span>
              <strong>{monthLabel(ym)} ainda não chegou.</strong> A nota sai quando o mês
              acontecer. Até lá dá para ver o que já está marcado para ele.
            </span>
          </div>

          {report.totals.count === 0 ? (
            <div className="empty span2">
              Nada marcado para {monthLabel(ym).toLowerCase()} ainda. Um fixo com mês de parada
              ou um parcelamento aparece aqui assim que você cria.
            </div>
          ) : (
            <div className="card span2">
              <div className="card__head">
                <span className="card__title">
                  <Icon name="wallet" size={15} />O que já está comprometido
                </span>
              </div>
              <div className="legend">
                {marcado
                  .filter(([, val]) => val > 0)
                  .map(([label, val, color]) => (
                    <div className="legend__row" key={label}>
                      <span className="legend__swatch" style={{ background: color }} />
                      <div className="legend__name">{label}</div>
                      <div>
                        <div className="legend__val num">{money(val)}</div>
                      </div>
                    </div>
                  ))}
              </div>
              <p className="dim" style={{ marginTop: 12 }}>
                {report.totals.count === 1
                  ? "1 lançamento já marcado para este mês."
                  : `${report.totals.count} lançamentos já marcados para este mês.`}{" "}
                Eles estão na aba Lançamentos, e dá para editar ou apagar qualquer um.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="scr">
      <div className="scr__top">
        <span className="scr__title">
          <Icon name="analises" size={18} />
          Análises
        </span>
        <div className="scr__tools">
          <button
            className="scr__tool"
            aria-label="Como a nota é calculada"
            onClick={() => setOpen((o) => !o)}
          >
            <Icon name="info" size={17} />
          </button>
        </div>
      </div>

      <MonthNav ym={ym} onChange={onMonth} />

      <div className="scr__body">
        {!report.closed && (
          <div className="banner span2">
            <Icon name="calendar" size={15} />
            <span>
              <strong>Prévia do mês em andamento.</strong> O relatório de{" "}
              {monthLabel(ym).toLowerCase()} fecha em {report.releaseDate}, com os números
              definitivos.
            </span>
          </div>
        )}

        {report.totals.count === 0 ? (
          <div className="empty span2">
            Sem lançamentos em {monthLabel(ym).toLowerCase()}, então não há o que analisar.
          </div>
        ) : (
          <>
            <div className="card card--score span2">
              <div className="hero__glow hero__glow--soft" aria-hidden="true" />
              <div className="card__head">
                <span className="card__title">
                  <Icon name="target" size={15} />
                  {report.closed ? "Relatório fechado" : "Nota parcial"} · {monthLabel(ym)}
                </span>
              </div>

              <div className="score">
                <ScoreRing value={report.score} size={72} />
                <div>
                  <div className="score__tier">
                    {report.tier}
                    <span className="tagsoft num">{Math.round(report.burn)}% da renda gasta</span>
                  </div>
                  <div className="score__sub">
                    Nota de 0 a 10, formada por três pilares com pesos diferentes.
                  </div>
                </div>
              </div>

              <div className="pillars">
                {report.pillars.map((p) => (
                  <div className="pillar" key={p.id}>
                    <div className="pillar__top">
                      <span className="pillar__name">{p.label}</span>
                      <span className="pillar__pts num">
                        {p.earned.toFixed(1).replace(".", ",")}
                        <span className="pillar__max">/{p.weight}</span>
                      </span>
                    </div>
                    <span className="pillar__track">
                      <span
                        className="pillar__fill"
                        style={{ width: `${(p.earned / p.weight) * 100}%` }}
                      />
                    </span>
                    <p className="pillar__detail">{p.detail}</p>
                  </div>
                ))}
              </div>

              <button className="disclose" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                <Icon name={open ? "chevronDown" : "chevronRight"} size={14} />
                Como a nota é calculada
              </button>

              {open && (
                <div className="method">
                  <p>
                    A nota é calculada pelo próprio Gastô a partir dos seus lançamentos, com as
                    mesmas regras todo mês. Nada aqui é opinião: são três medidas somadas.
                  </p>
                  <ul>
                    <li>
                      <strong>Controle de gastos, 50 pontos.</strong> Quanto da sua renda virou
                      despesa. Gastar até 50% vale a nota cheia; a partir de 110% o pilar zera.
                    </li>
                    <li>
                      <strong>Consistência, 30 pontos.</strong> 20 pontos medem o tamanho do maior
                      dia do mês (até 15% do total vale tudo, 60% ou mais zera) e 10 pontos medem
                      em quantos dias houve movimento.
                    </li>
                    <li>
                      <strong>Organização, 20 pontos.</strong> 8 pontos pela fatia categorizada
                      fora de “Outros”, 6 pela frequência com que você registra e 6 pelo peso dos
                      gastos fixos sobre a renda.
                    </li>
                  </ul>
                  <p className="method__foot">
                    O relatório de cada mês é gerado no dia 1º do mês seguinte e não muda depois
                    disso. O mês em andamento aparece como prévia.
                  </p>
                </div>
              )}
            </div>

            <div className="card">
              <div className="card__head">
                <span className="card__title">
                  <Icon name="wallet" size={15} />
                  Fixos e variáveis sobre a renda
                </span>
              </div>
              {totals.receitas === 0 ? (
                <p className="dim">
                  Sem receita registrada neste mês, então não dá para medir a proporção.
                </p>
              ) : (
                <>
                  <Donut
                    caption=""
                    total={split.total}
                    ofTotal={totals.receitas}
                    slices={[
                      { label: "Fixos", value: split.fixo, color: "var(--ink)" },
                      { label: "Variáveis", value: split.variavel, color: "var(--pos)" },
                    ]}
                  />
                  <div className="legend">
                    {[
                      ["Fixos", split.fixo, "var(--ink)"],
                      ["Variáveis", split.variavel, "var(--pos)"],
                    ].map(([label, val, color]) => (
                      <div className="legend__row" key={String(label)}>
                        <span className="legend__swatch" style={{ background: String(color) }} />
                        <div className="legend__name">{String(label)}</div>
                        <div>
                          <div className="legend__val num">{money(Number(val))}</div>
                          <div className="legend__pct num">
                            {pct((Number(val) / totals.receitas) * 100)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <div className="card__head">
                <span className="card__title">
                  <Icon name="eye" size={15} />O que chamou atenção
                </span>
              </div>
              <div className="notes">
                {report.highlights.map((h) => (
                  <div className="note" key={h}>
                    <Icon name="info" size={14} />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card span2">
              <div className="card__head">
                <span className="card__title">
                  <Icon name="target" size={15} />
                  Para o próximo mês
                </span>
              </div>
              <div className="notes notes--grid">
                {report.advice.map((a) => (
                  <div className="note note--do" key={a}>
                    <Icon name="arrowUpRight" size={14} />
                    <span>{a}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <span className="card__title">
                  <Icon name="filter" size={15} />
                  Distribuição por categoria
                </span>
                <span className="tagsoft num">{slices.length}</span>
              </div>
              <div className="catbar">
                {slices.slice(0, 8).map((c, i) => (
                  <div className="catbar__row" key={c.id}>
                    <span className="catbar__name">
                      <span className="emo">{c.emoji}</span>
                      {c.label}
                    </span>
                    <span className="catbar__val">
                      {money(c.total)} <span className="dim">{pct(c.share)}</span>
                    </span>
                    <span className="catbar__track">
                      <span
                        className={`catbar__fill${i === 0 ? " catbar__fill--top" : ""}`}
                        style={{ width: `${(c.total / maxCat) * 100}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <span className="card__title">
                  <Icon name="calendar" size={15} />
                  Gastos por dia da semana
                </span>
              </div>
              <WeekdayBars data={week} />
              <p className="dim">
                Só gasto variável. Conta fixa cai sempre no mesmo dia e viraria um paredão
                que não diz nada sobre o seu hábito.
              </p>
            </div>

            {isCurrent && (
              <p className="finefoot span2">
                Você está vendo o mês corrente. Use as setas acima para abrir o relatório fechado
                dos meses anteriores.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
