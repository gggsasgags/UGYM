import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon";
import { Foto } from "../components/Foto";
import { Sheet } from "../components/Sheet";
import { BASE_CATEGORIES, slugify } from "../lib/categories";
import {
  centavosParaNumero,
  centavosParaTexto,
  digitos,
  money,
  monthLabel,
  shiftMonth,
  todayYM,
} from "../lib/format";
import { WIDGETS } from "../lib/home";
import { useStore, EMPTY_TAPE, type NewEntry } from "../lib/store";
import { Calculator } from "./Calculator";
import { Confirm, type Pergunta } from "../components/Confirm";
import { EmojiPicker } from "../components/EmojiPicker";
import { ColumnMap } from "./ColumnMap";
import { ExportSheet } from "./ExportSheet";
import { InstallSheet } from "./InstallSheet";
import { withoutKnown, type ImportResult } from "../lib/statements";
import { triar } from "../lib/triagem";
import { aplicarRegras, aprenderDaConferencia, type Regra } from "../lib/regras";
import type { Category, Kind, Recurrence, Transaction } from "../lib/types";
import { lerParcelaNaDescricao, parcelasAte, type ParcelaLida } from "../lib/parcelas";
import {
  HomeScreen,
  InsightsScreen,
  SummaryScreen,
  TransactionsScreen,
} from "../screens/Screens";
import "./app.css";

const TABS: { key: string; path: string; label: string; icon: IconName }[] = [
  { key: "inicio", path: "/app", label: "Início", icon: "inicio" },
  { key: "lancamentos", path: "/app/lancamentos", label: "Lançamentos", icon: "lancamentos" },
  { key: "resumo", path: "/app/resumo", label: "Resumo", icon: "resumo" },
  { key: "analises", path: "/app/analises", label: "Análises", icon: "analises" },
];

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

type Modal =
  | { kind: "entry"; tx: Transaction | null }
  | { kind: "categories" }
  | { kind: "profile" }
  | { kind: "home" }
  | { kind: "import"; result: ImportResult }
  | { kind: "colunas"; result: ImportResult }
  | { kind: "exportar" }
  | { kind: "instalar" }
  | null;

export default function AppShell() {
  const { tab = "inicio" } = useParams();
  const navigate = useNavigate();
  const store = useStore();
  const { account, transactions, categories, home, ready, theme, calc, calcOpen, notice } = store;
  const [ym, setYm] = useState(todayYM);
  const [modal, setModal] = useState<Modal>(null);
  const [menu, setMenu] = useState(false);
  /* Nada que apaga dado acontece direto: tudo passa por uma pergunta. */
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);

  useEffect(() => {
    if (ready && !account) navigate("/entrar", { replace: true });
  }, [ready, account, navigate]);

  const props = {
    tx: transactions,
    ym,
    cats: categories,
    account,
    home,
    today: isoToday(),
    onMonth: (d: number) => setYm((m) => shiftMonth(m, d)),
    onAdd: () => setModal({ kind: "entry", tx: null }),
    onEdit: (t: Transaction) => setModal({ kind: "entry", tx: t }),
    onRemove: (id: string) => {
      const alvo = transactions.find((t) => t.id === id);
      setPergunta({
        titulo: "Apagar este lançamento?",
        texto: alvo
          ? `"${alvo.description}", de ${money(alvo.amount)}, sai da sua carteira. Não dá para desfazer.`
          : "O lançamento sai da sua carteira e não dá para desfazer.",
        rotulo: "Apagar",
        acao: () => store.remove(id),
      });
    },
    onClearMonth: () => {
      const doMes = transactions.filter((t) => t.date.slice(0, 7) === ym).length;
      setPergunta({
        titulo: `Apagar todos os lançamentos de ${monthLabel(ym)}?`,
        texto:
          doMes === 1
            ? "É 1 lançamento, e ele não volta. As séries fixas continuam valendo nos outros meses."
            : `São ${doMes} lançamentos, e eles não voltam. As séries fixas continuam valendo nos outros meses.`,
        rotulo: doMes === 1 ? "Apagar o lançamento" : `Apagar os ${doMes}`,
        acao: () => store.removeMonth(ym),
      });
    },
    onCategories: () => setModal({ kind: "categories" }),
    onCustomize: () => setModal({ kind: "home" }),
    onReorder: store.setHome,
    onRemoveWidget: (id: string) => store.setHome(home.filter((w) => w !== id)),
    onMenu: () => setMenu(true),
    onExport: () => setModal({ kind: "exportar" }),
    onProfile: () => setModal({ kind: "profile" }),
    onImport: (result: ImportResult) =>
      /* Arquivo em tabela sempre passa pela conferência de colunas: é ali
         que o usuário conserta o que o Gastô leu errado. PDF não tem
         coluna nenhuma, então vai direto para a confirmação. */
      setModal(
        result.table
          ? { kind: "colunas", result }
          : { kind: "import", result: withoutKnown(result, transactions) }
      ),
  };

  const screen =
    tab === "lancamentos" ? (
      <TransactionsScreen {...props} />
    ) : tab === "resumo" ? (
      <SummaryScreen {...props} />
    ) : tab === "analises" ? (
      <InsightsScreen {...props} />
    ) : (
      <HomeScreen {...props} />
    );

  const leave = () => {
    store.signOut();
    navigate("/");
  };

  return (
    <div className="shell" data-theme={theme === "escuro" ? "dark" : undefined}>
      {menu && (
        <div className="drawer" role="dialog" aria-label="Menu">
          <button className="drawer__scrim" aria-label="Fechar" onClick={() => setMenu(false)} />
          <aside className="drawer__panel">
            <div className="drawer__head">
              <span className="drawer__me">
                <span className="shell__avatar">
                  <Foto
                    src={account?.avatar}
                    letra={(account?.name ?? "V").charAt(0).toUpperCase()}
                  />
                </span>
                <span className="drawer__id">
                  <strong>{account?.name}</strong>
                  <span>{account?.email}</span>
                </span>
              </span>
              <button className="scr__tool" onClick={() => setMenu(false)} aria-label="Fechar">
                <Icon name="close" size={18} />
              </button>
            </div>

            <span className="drawer__h mono">Aparência</span>

            <button
              className="drawer__row"
              onClick={() => store.setTheme(theme === "escuro" ? "claro" : "escuro")}
              aria-pressed={theme === "escuro"}
            >
              <Icon name="eye" size={18} />
              <span className="drawer__txt">
                <strong>Modo escuro</strong>
                <span>Fundo escuro no aplicativo inteiro.</span>
              </span>
              <span className="switch" data-on={theme === "escuro"} />
            </button>

            <button
              className="drawer__row"
              onClick={() => store.setCalc(!calc)}
              aria-pressed={calc}
            >
              <Icon name="calc" size={18} />
              <span className="drawer__txt">
                <strong>Calculadora flutuante</strong>
                <span>Um botão em todas as abas, para contas rápidas.</span>
              </span>
              <span className="switch" data-on={calc} />
            </button>

            <span className="drawer__h mono">Conta</span>

            <button
              className="drawer__row drawer__row--plain"
              onClick={() => {
                setMenu(false);
                setModal({ kind: "profile" });
              }}
            >
              <Icon name="pessoal" size={18} />
              <span className="drawer__txt">
                <strong>Seu perfil</strong>
              </span>
            </button>

            <button
              className="drawer__row drawer__row--plain"
              onClick={() => {
                setMenu(false);
                setModal({ kind: "categories" });
              }}
            >
              <Icon name="tag" size={18} />
              <span className="drawer__txt">
                <strong>Categorias</strong>
              </span>
            </button>

            <button
              className="drawer__row drawer__row--plain"
              onClick={() => {
                setMenu(false);
                setModal({ kind: "instalar" });
              }}
            >
              <Icon name="celular" size={18} />
              <span className="drawer__txt">
                <strong>Deixar na tela do celular</strong>
              </span>
            </button>

            <Link className="drawer__row drawer__row--plain" to="/" onClick={() => setMenu(false)}>
              <Icon name="arrowUpRight" size={18} />
              <span className="drawer__txt">
                <strong>Abrir o site do Gastô</strong>
              </span>
            </Link>

            <button className="drawer__row drawer__row--out" onClick={leave}>
              <Icon name="logout" size={18} />
              <span className="drawer__txt">
                <strong>Sair da conta</strong>
              </span>
            </button>
          </aside>
        </div>
      )}

      <main className="shell__stage">{screen}</main>

      <nav className="tabbar" aria-label="Seções do aplicativo">
        <div className="tabbar__in">
          {TABS.map((t) => (
            <Link
              key={t.key}
              to={t.path}
              className="tab"
              aria-current={t.key === tab ? "page" : undefined}
            >
              <Icon name={t.icon} size={20} stroke={t.key === tab ? 1.9 : 1.6} />
              {t.label}
            </Link>
          ))}
        </div>
      </nav>

      {notice && (
        <div className="notice" role="status">
          <Icon name="alert" size={16} />
          <span>{notice}</span>
          <button onClick={store.dismissNotice} aria-label="Fechar aviso">
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      {calc && (
        <>
          {!calcOpen && (
            <button
              className="calcfab"
              onClick={() => store.setCalcOpen(true)}
              aria-label="Abrir calculadora"
            >
              <Icon name="calc" size={22} />
            </button>
          )}
          {calcOpen && (
            <Calculator
              tape={store.calcTape}
              onTape={store.setCalcTape}
              onClose={() => {
                store.setCalcOpen(false);
                store.setCalcTape(EMPTY_TAPE);
              }}
            />
          )}
        </>
      )}

      {pergunta && <Confirm pergunta={pergunta} onClose={() => setPergunta(null)} />}

      {modal?.kind === "entry" && (
        <EntrySheet
          existing={modal.tx}
          defaultMonth={ym}
          cats={categories}
          onCreateCategory={store.saveCategory}
          onClose={() => setModal(null)}
          onCreate={(entry) => {
            store.add(entry);
            setYm(entry.date.slice(0, 7));
            setModal(null);
          }}
          onUpdate={(id, patch) => {
            store.update(id, patch);
            setModal(null);
          }}
          onDeleteSeries={(sid) => {
            const daSerie = transactions.filter((t) => t.seriesId === sid).length;
            setModal(null);
            setPergunta({
              titulo: "Apagar a série inteira?",
              texto: `Todas as ocorrências deste lançamento saem, em todos os meses${
                daSerie ? `, ${daSerie} no total` : ""
              }. Não dá para desfazer.`,
              rotulo: "Apagar a série",
              acao: () => store.removeSeries(sid),
            });
          }}
        />
      )}

      {modal?.kind === "categories" && (
        <CategorySheet
          cats={categories}
          usage={transactions}
          onSave={store.saveCategory}
          onRestore={store.restoreBaseCategories}
          onDelete={(cat, quantos) =>
            setPergunta({
              titulo: `Apagar a categoria ${cat.label}?`,
              texto: quantos
                ? `${quantos === 1 ? "1 lançamento vai" : `${quantos} lançamentos vão`} para “Outros”. Nenhum deles é apagado.`
                : "Ela não tem nenhum lançamento, então nada muda na sua carteira.",
              rotulo: "Apagar a categoria",
              acao: () => store.removeCategory(cat.id),
            })
          }
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "profile" && (
        <ProfileSheet
          name={account?.name ?? ""}
          email={account?.email ?? ""}
          avatar={account?.avatar}
          onSave={(n, a) => {
            store.setName(n);
            store.setAvatar(a);
            setModal(null);
          }}
          onExport={() => setModal({ kind: "exportar" })}
          onApagarConta={() => store.apagarConta()}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.kind === "home" && (
        <HomeSheet current={home} onSave={(ids) => { store.setHome(ids); setModal(null); }} onClose={() => setModal(null)} />
      )}

      {modal?.kind === "instalar" && <InstallSheet onClose={() => setModal(null)} />}

      {modal?.kind === "exportar" && (
        <ExportSheet
          tx={transactions}
          cats={categories}
          mesAtual={ym}
          onClose={() => setModal(null)}
          onAviso={store.showNotice}
        />
      )}

      {modal?.kind === "colunas" && modal.result.table && (
        <ColumnMap
          tabela={modal.result.table}
          source={modal.result.source}
          cats={categories}
          onClose={() => setModal(null)}
          onPronto={(r) => setModal({ kind: "import", result: withoutKnown(r, transactions) })}
        />
      )}

      {modal?.kind === "import" && (
        <ImportSheet
          result={modal.result}
          nome={account?.name ?? ""}
          existentes={transactions}
          cats={categories}
          regras={store.regras}
          onConfirm={(rows, virarMovimentacao, novasRegras) => {
            /* Categorias novas, linhas novas, os dois lados da
               transferência e o que acabou de ser ensinado: uma escrita só. */
            store.importar(rows, modal.result.newCategories, virarMovimentacao, novasRegras);
            // leva o usuário para o mês mais recente do extrato, senão ele
            // importa e continua olhando um mês vazio
            const months = rows.map((r) => r.date.slice(0, 7)).sort();
            if (months.length) setYm(months[months.length - 1]);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

/* ------------------- folha de novo lançamento / edição ------------------- */

function EntrySheet({
  existing,
  defaultMonth,
  cats,
  onClose,
  onCreate,
  onUpdate,
  onDeleteSeries,
  onCreateCategory,
}: {
  existing: Transaction | null;
  defaultMonth: string;
  cats: Category[];
  onClose: () => void;
  onCreate: (entry: NewEntry) => void;
  onUpdate: (id: string, patch: Partial<Transaction>) => void;
  onDeleteSeries: (seriesId: string) => void;
  onCreateCategory: (c: Category) => string;
}) {
  const editMode = Boolean(existing);
  const [kind, setKind] = useState<Kind>(existing?.kind ?? "despesa");
  const [description, setDescription] = useState(existing?.description ?? "");
  /* Guardamos os dígitos, e não o texto formatado: assim o campo pode
     mostrar "1.234,50" sem que ninguém precise reinterpretar essa vírgula
     na hora de salvar. */
  const [centavos, setCentavos] = useState(
    existing ? String(Math.round(existing.amount * 100)) : ""
  );
  const valorRef = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState<string>(existing?.category ?? "mercado");
  const [date, setDate] = useState(
    existing?.date ??
      `${defaultMonth}-${String(Math.min(new Date().getDate(), 28)).padStart(2, "0")}`
  );
  const [recurrence, setRecurrence] = useState<Recurrence>(existing?.recurrence ?? "variavel");
  const [repeat, setRepeat] = useState<NewEntry["repeat"]>("none");
  const [touched, setTouched] = useState(false);

  /* ----------------------------------------------------------------
     Parcelar virou uma pergunta de calendário.

     Antes aqui havia um campo "Número de parcelas" com um 10 dentro, e
     o Diego apontou o problema em 13/10/2026: ninguém pensa em "dez
     vezes", pensa em "até julho". Então a escolha agora é o mês da
     última parcela, e a quantidade aparece calculada embaixo.

     O segundo campo resolve a ambiguidade que estava escondida: o
     valor digitado era repetido em todas as parcelas, então R$ 500 em
     dez vezes virava R$ 5.000. Agora a pessoa diz se aquele número é o
     total ou é cada parcela, e a frase mostra a conta pronta.
  ---------------------------------------------------------------- */
  const [ultimoMes, setUltimoMes] = useState(() => shiftMonth(defaultMonth, 9));
  const [valorEhTotal, setValorEhTotal] = useState(true);
  /* O fim do fixo mensal é opcional: a maioria dos fixos não acaba. */
  const [temFim, setTemFim] = useState(false);
  const [fimMes, setFimMes] = useState(() => shiftMonth(defaultMonth, 11));
  /* a parcela lida da descrição, quando a pessoa escreveu "5 de 6" */
  const [comecaEm, setComecaEm] = useState<number | null>(null);
  const [leuDaDescricao, setLeuDaDescricao] = useState<ParcelaLida | null>(null);
  const recusouLeitura = useRef("");
  const [newCat, setNewCat] = useState<{ label: string; emoji: string } | null>(null);

  /* Movimentação não tem categoria própria: ela só passa por uma. Filtrar
     por tipo deixaria a lista vazia e o botão de salvar morto, que é
     exatamente o que acontecia ao abrir um lançamento importado como
     transferência. */
  const options = useMemo(
    () => (kind === "movimentacao" ? cats : cats.filter((c) => c.kind === kind)),
    [cats, kind]
  );

  useEffect(() => {
    if (!options.some((o) => o.id === cat) && options[0]) setCat(options[0].id);
  }, [options, cat]);

  const value = centavosParaNumero(centavos);

  /* Quantas parcelas cabem daqui até o mês escolhido, e quanto fica cada
     uma. Quando a compra começa no meio, o total é o que a pessoa
     escreveu em "5 de 6" e o mês final sai dele, não do seletor. */
  const totalParcelas = comecaEm
    ? (leuDaDescricao?.total ?? 2)
    : parcelasAte(date, ultimoMes);
  const faltam = comecaEm ? totalParcelas - comecaEm + 1 : totalParcelas;
  const valorDaParcela =
    valorEhTotal && !comecaEm && totalParcelas > 0
      ? Math.round((value / totalParcelas) * 100) / 100
      : value;
  const mesFinal = comecaEm
    ? shiftMonth(date.slice(0, 7), faltam - 1)
    : ultimoMes;
  /* Dá para apagar todas as categorias, inclusive as que vêm prontas.
     Se não sobrou nenhuma do tipo escolhido, o lançamento não tem onde
     entrar, e salvar criaria um órfão. */
  const valid = description.trim().length > 0 && value > 0 && options.length > 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    const base = {
      description: description.trim(),
      amount: value,
      kind,
      category: cat,
      date,
      /* Receita não tem fixo nem variável. Guardamos um valor neutro só
         porque a coluna existe; nenhuma tela usa ele para recebimento. */
      recurrence: kind === "despesa" ? recurrence : "variavel",
    } as const;
    if (existing) onUpdate(existing.id, base);
    else
      onCreate({
        ...base,
        /* o valor que vai para a série é o da parcela, já dividido se a
           pessoa disse que digitou o total */
        amount: repeat === "parcelado" ? valorDaParcela : base.amount,
        repeat,
        installments: repeat === "parcelado" ? totalParcelas : undefined,
        ateYM: repeat === "mensal" && temFim ? fimMes : undefined,
        comecaEm: repeat === "parcelado" && comecaEm ? comecaEm : undefined,
      });
  };

  /* ----------------------------------------------------------------
     Ler a parcela que a pessoa escreveu na descrição.

     Quem digita "revisão do carro 5 de 6" já disse tudo: que é
     parcelamento e que está na quinta de seis. O app lê isso quando o
     campo perde o foco, e não enquanto a pessoa digita, senão "5 de 60"
     dispararia no meio da palavra.

     O número sai da descrição de propósito. Ele volta na hora de
     mostrar a linha, e deixar os dois era o que produzia a maluquice
     que o Diego viu: "revisão do carro 5 de 6 1/2".
  ---------------------------------------------------------------- */
  const lerDescricao = () => {
    if (editMode) return;
    const texto = description.trim();
    if (!texto || recusouLeitura.current === texto) return;
    const lido = lerParcelaNaDescricao(texto);
    if (!lido) return;
    setDescription(lido.limpa);
    setRepeat("parcelado");
    setComecaEm(lido.atual);
    setLeuDaDescricao(lido);
    setValorEhTotal(false);
  };

  const desfazerLeitura = () => {
    if (!leuDaDescricao) return;
    const voltou = `${leuDaDescricao.limpa} ${leuDaDescricao.atual} de ${leuDaDescricao.total}`;
    recusouLeitura.current = voltou;
    setDescription(voltou);
    setRepeat("none");
    setComecaEm(null);
    setLeuDaDescricao(null);
    /* A leitura tinha assumido que o valor digitado era o da parcela,
       porque é isso que quem escreve "5 de 6" está pagando no mês. Se a
       pessoa desfez, a pergunta volta a valer e o padrão volta com ela. */
    setValorEhTotal(true);
  };

  const confirmNewCat = () => {
    if (!newCat?.label.trim()) return;
    const id = onCreateCategory({
      id: slugify(newCat.label),
      label: newCat.label.trim(),
      emoji: newCat.emoji || "🏷️",
      kind,
    });
    setCat(id);
    setNewCat(null);
  };

  return (
    <Sheet title={editMode ? "Editar lançamento" : "Novo lançamento"} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {/* Movimentação não se cria à mão: ela nasce da conferência do
            extrato, quando o Gastô reconhece os dois lados de uma
            transferência sua. Oferecer o botão aqui só convidava a marcar
            gasto como movimentação e sumir com ele da conta do mês. */}
        <div className="seg seg--block seg--ink" role="tablist">
          <button
            type="button"
            className="seg__i"
            role="tab"
            aria-selected={kind === "despesa"}
            onClick={() => setKind("despesa")}
          >
            Despesa
          </button>
          <button
            type="button"
            className="seg__i"
            role="tab"
            aria-selected={kind === "receita"}
            onClick={() => setKind("receita")}
          >
            Receita
          </button>
        </div>

        {/* Movimentação antiga continua editável: o que não dá é criar uma.
            Enquanto ninguém toca nas abas, ela segue sendo movimentação. */}
        {kind === "movimentacao" && (
          <p className="field__hint">
            Este lançamento veio do extrato como transferência entre as suas contas, e por
            isso fica fora da conta do mês. Toque em despesa ou receita para trazer ele
            para dentro.
          </p>
        )}

        <label className="field field--valor">
          <span>Valor</span>
          <div className="valor">
            <span className="valor__rs" aria-hidden="true">R$</span>
            <input
              id="nl-valor"
              ref={valorRef}
              value={centavos ? centavosParaTexto(centavos) : ""}
              onChange={(e) => setCentavos(digitos(e.target.value))}
              /* O cursor no meio do número faria o dígito entrar no lugar
                 errado. Aqui ele só existe no fim, como no teclado do banco. */
              onSelect={() => {
                const el = valorRef.current;
                if (!el) return;
                const fim = el.value.length;
                if (el.selectionStart !== fim || el.selectionEnd !== fim)
                  el.setSelectionRange(fim, fim);
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0,00"
              autoFocus
            />
          </div>
        </label>

        <label className="field">
          <span>Descrição</span>
          <input
            id="nl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={lerDescricao}
            placeholder="Supermercado"
          />
        </label>

        <label className="field">
          <span>Data</span>
          <input id="nl-data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <div className="field">
          <span className="field__row">
            Categoria
            <button
              type="button"
              className="minilink"
              onClick={() => setNewCat({ label: "", emoji: "🏷️" })}
            >
              <Icon name="plus" size={13} />
              Nova categoria
            </button>
          </span>
          <select id="nl-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.emoji} {o.label}
              </option>
            ))}
          </select>
          {options.length === 0 && (
            <p className="field__err">
              Você não tem nenhuma categoria de {kind === "receita" ? "receita" : "despesa"}. Crie
              uma aqui em cima para poder salvar.
            </p>
          )}
        </div>

        {newCat && (
          <div className="inlinecat">
            <div className="inlinecat__row">
              <input
                className="inlinecat__emoji"
                value={newCat.emoji}
                onChange={(e) => setNewCat({ ...newCat, emoji: e.target.value.slice(0, 4) })}
                aria-label="Emoji da categoria"
                title="Emoji da categoria: escolha um na lista abaixo ou digite aqui"
              />
              <input
                className="inlinecat__name"
                value={newCat.label}
                onChange={(e) => setNewCat({ ...newCat, label: e.target.value })}
                placeholder="Nome da categoria"
                autoFocus
              />
              <button type="button" className="btn btn--pos btn--sm" onClick={confirmNewCat}>
                Criar
              </button>
              {/* Abrir isto sem querer obrigava a sair do lançamento inteiro
                  e começar de novo. */}
              <button
                type="button"
                className="inlinecat__sair"
                onClick={() => setNewCat(null)}
                aria-label="Fechar a nova categoria"
                title="Fechar"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <EmojiPicker
              value={newCat.emoji}
              nome={newCat.label}
              onPick={(e) => setNewCat({ ...newCat, emoji: e })}
            />
          </div>
        )}

        {/* Fixo e variável é conversa de gasto. Dinheiro que entra não se
            divide assim, então a pergunta some quando é recebimento. */}
        {kind === "despesa" && (
        <div className="field">
          <span>Tipo de gasto</span>
          <div className="seg seg--block" role="tablist">
            <button
              type="button"
              className="seg__i"
              role="tab"
              aria-selected={recurrence === "fixo"}
              onClick={() => setRecurrence("fixo")}
            >
              Fixo
            </button>
            <button
              type="button"
              className="seg__i"
              role="tab"
              aria-selected={recurrence === "variavel"}
              onClick={() => setRecurrence("variavel")}
            >
              Variável
            </button>
          </div>
        </div>
        )}

        {!editMode && (
          <div className="field">
            <span>Repetição</span>
            <div className="seg seg--block" role="tablist">
              {(
                [
                  ["none", "Só este mês"],
                  ["mensal", "Todo mês"],
                  ["parcelado", "Parcelado"],
                ] as const
              ).map(([v, label]) => (
                <button
                  type="button"
                  key={v}
                  className="seg__i"
                  role="tab"
                  aria-selected={repeat === v}
                  onClick={() => setRepeat(v)}
                >
                  {label}
                </button>
              ))}
            </div>

            {repeat === "mensal" && (
              <>
                <p className="field__hint">
                  O mesmo valor reaparece sozinho todo mês, a partir desta data.
                </p>
                <label className="repet__ate">
                  <input
                    type="checkbox"
                    checked={temFim}
                    onChange={(e) => setTemFim(e.target.checked)}
                  />
                  <span>Parar em algum mês</span>
                </label>
                {temFim && (
                  <>
                    <label className="field" style={{ marginTop: 8 }}>
                      <span>Último mês</span>
                      <input
                        id="nl-fim"
                        type="month"
                        value={fimMes}
                        min={date.slice(0, 7)}
                        onChange={(e) => setFimMes(e.target.value || fimMes)}
                      />
                    </label>
                    <p className="field__hint">
                      Vai de {monthLabel(date.slice(0, 7))} a {monthLabel(fimMes)}, e para sozinho
                      depois disso.
                    </p>
                  </>
                )}
              </>
            )}

            {repeat === "parcelado" && (
              <>
                {leuDaDescricao ? (
                  /* A leitura do "5 de 6" aparece escrita, e com saída. Um
                     app que adivinha sem avisar é pior que um que não
                     adivinha. */
                  <div className="lido">
                    <Icon name="check" size={14} />
                    <p>
                      Li <b>{leuDaDescricao.atual} de {leuDaDescricao.total}</b> na descrição e
                      continuei daí. Tirei o número do nome porque o Gastô numera sozinho.
                      <button type="button" onClick={desfazerLeitura}>
                        desfazer
                      </button>
                    </p>
                  </div>
                ) : (
                  <label className="field" style={{ marginTop: 10 }}>
                    <span>Última parcela em</span>
                    <input
                      id="nl-ate"
                      type="month"
                      value={ultimoMes}
                      min={shiftMonth(date.slice(0, 7), 1)}
                      onChange={(e) => setUltimoMes(e.target.value || ultimoMes)}
                    />
                  </label>
                )}

                {/* A pergunta que faltava. Sem ela, R$ 500 em dez vezes
                    virava R$ 5.000 sem ninguém perceber. */}
                {!comecaEm && (
                  <div className="field" style={{ marginTop: 10 }}>
                    <span>O valor que você digitou é</span>
                    <div className="seg seg--block" role="tablist">
                      <button
                        type="button"
                        className="seg__i"
                        role="tab"
                        aria-selected={valorEhTotal}
                        onClick={() => setValorEhTotal(true)}
                      >
                        O total da compra
                      </button>
                      <button
                        type="button"
                        className="seg__i"
                        role="tab"
                        aria-selected={!valorEhTotal}
                        onClick={() => setValorEhTotal(false)}
                      >
                        Cada parcela
                      </button>
                    </div>
                  </div>
                )}

                <p className="field__hint">
                  {value > 0 ? (
                    <>
                      <b>
                        {faltam} {faltam === 1 ? "parcela" : "parcelas"} de {money(valorDaParcela)}
                      </b>
                      , de {monthLabel(date.slice(0, 7))} a {monthLabel(mesFinal)}
                      {comecaEm
                        ? `, numeradas de ${comecaEm} a ${totalParcelas}.`
                        : "."}
                    </>
                  ) : (
                    <>
                      {faltam} {faltam === 1 ? "parcela" : "parcelas"}, de{" "}
                      {monthLabel(date.slice(0, 7))} a {monthLabel(mesFinal)}. Informe o valor para
                      ver quanto fica cada uma.
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        )}

        {editMode && existing?.seriesId && (
          <p className="field__hint">
            Este lançamento veio de uma série. Editar aqui muda só a ocorrência deste mês.
          </p>
        )}

        {touched && !valid && (
          <p className="field__err">Informe uma descrição e um valor maior que zero para salvar.</p>
        )}

        <button className="btn btn--pos" type="submit" style={{ width: "100%" }}>
          {editMode ? "Salvar alterações" : "Salvar lançamento"}
        </button>

        {editMode && (
          <button
            type="button"
            className="btn btn--ghost"
            style={{ width: "100%" }}
            onClick={() =>
              valid &&
              onCreate({
                description: `${description.trim()} (cópia)`,
                amount: value,
                kind,
                category: cat,
                date,
                recurrence: kind === "despesa" ? recurrence : "variavel",
                repeat: "none",
              })
            }
          >
            Duplicar lançamento
          </button>
        )}

        {editMode && existing?.seriesId && (
          <button
            type="button"
            className="sheet__danger"
            onClick={() => onDeleteSeries(existing.seriesId!)}
          >
            <Icon name="trash" size={14} />
            Apagar a série inteira, em todos os meses
          </button>
        )}
      </form>
    </Sheet>
  );
}

/* -------------------------- gerenciar categorias -------------------------- */

function CategorySheet({
  cats,
  usage,
  onSave,
  onDelete,
  onRestore,
  onClose,
}: {
  cats: Category[];
  usage: Transaction[];
  onSave: (c: Category) => string;
  onDelete: (cat: Category, quantos: number) => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState<{ label: string; emoji: string; kind: Kind } | null>(
    null
  );

  const count = (id: string) => usage.filter((t) => t.category === id).length;
  const faltando = BASE_CATEGORIES.filter((b) => !cats.some((c) => c.id === b.id)).length;

  return (
    <Sheet title="Categorias" onClose={onClose} wide>
      <p className="dim">
        As categorias que já vêm no Gastô são só um ponto de partida: pode renomear, trocar o
        emoji e apagar as que você não usa. Os lançamentos de uma categoria apagada voltam para
        “Outros”, que por isso é a única que fica.
      </p>

      {creating ? (
        <div className="inlinecat">
          <div className="inlinecat__row">
            <input
              className="inlinecat__emoji"
              value={creating.emoji}
              onChange={(e) => setCreating({ ...creating, emoji: e.target.value.slice(0, 4) })}
              aria-label="Emoji"
            />
            <input
              className="inlinecat__name"
              value={creating.label}
              onChange={(e) => setCreating({ ...creating, label: e.target.value })}
              placeholder="Nome da categoria"
              autoFocus
            />
            <select
              value={creating.kind}
              onChange={(e) => setCreating({ ...creating, kind: e.target.value as Kind })}
              aria-label="Tipo"
            >
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </select>
          </div>
          <EmojiPicker
            value={creating.emoji}
            nome={creating.label}
            onPick={(e) => setCreating({ ...creating, emoji: e })}
          />
          <div className="sheet__acts">
            <button
              className="btn btn--pos"
              style={{ flex: 1 }}
              onClick={() => {
                if (!creating.label.trim()) return;
                onSave({
                  id: slugify(creating.label),
                  label: creating.label.trim(),
                  emoji: creating.emoji || "🏷️",
                  kind: creating.kind,
                });
                setCreating(null);
              }}
            >
              Criar categoria
            </button>
            <button className="btn btn--ghost" onClick={() => setCreating(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn--pos"
          style={{ width: "100%" }}
          onClick={() => setCreating({ label: "", emoji: "🏷️", kind: "despesa" })}
        >
          <Icon name="plus" size={16} />
          Nova categoria
        </button>
      )}

      <div className="catlist">
        {cats.map((c) =>
          editing?.id === c.id ? (
            <div className="catlist__row catlist__row--edit" key={c.id}>
              <input
                className="inlinecat__emoji"
                value={editing.emoji}
                onChange={(e) => setEditing({ ...editing, emoji: e.target.value.slice(0, 4) })}
                aria-label="Emoji"
              />
              <input
                className="inlinecat__name"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                aria-label="Nome"
                autoFocus
              />
              <button
                className="btn btn--pos btn--sm"
                onClick={() => {
                  if (editing.label.trim()) onSave({ ...editing, label: editing.label.trim() });
                  setEditing(null);
                }}
              >
                Salvar
              </button>
            </div>
          ) : (
            <div className="catlist__row" key={c.id}>
              <span className="emo emo--lg">{c.emoji}</span>
              <span className="catlist__txt">
                <strong>{c.label}</strong>
                <span className="dim">
                  {c.kind === "receita" ? "Receita" : "Despesa"} · {count(c.id)}{" "}
                  {count(c.id) === 1 ? "lançamento" : "lançamentos"}
                </span>
              </span>
              <button
                className="scr__tool"
                aria-label={`Editar ${c.label}`}
                onClick={() => setEditing(c)}
              >
                <Icon name="edit" size={15} />
              </button>
              <button
                className="scr__tool"
                aria-label={`Apagar ${c.label}`}
                disabled={c.id === "outros"}
                title={
                  c.id === "outros"
                    ? "É para cá que vão os lançamentos de uma categoria apagada"
                    : "Apagar"
                }
                onClick={() => onDelete(c, count(c.id))}
              >
                <Icon name="trash" size={15} />
              </button>
            </div>
          )
        )}
      </div>

      {/* Só aparece para quem apagou alguma: é o caminho de volta, e fica
          quieto enquanto não faz falta. */}
      {faltando > 0 && (
        <button className="minilink" style={{ alignSelf: "flex-start" }} onClick={onRestore}>
          <Icon name="assinaturas" size={13} />
          Restaurar {faltando === 1 ? "a categoria que vem pronta" : `as ${faltando} categorias que vêm prontas`}
        </button>
      )}
    </Sheet>
  );
}

/* ------------------------------- perfil ------------------------------- */

function ProfileSheet({
  name,
  email,
  avatar,
  onSave,
  onClose,
  onExport,
  onApagarConta,
}: {
  name: string;
  email: string;
  avatar?: string;
  onSave: (name: string, foto: Blob | null | undefined) => void;
  onClose: () => void;
  onExport: () => void;
  onApagarConta: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [n, setN] = useState(name);
  /* Três estados, e não um só: fechado, aberto pedindo a palavra, e
     apagando. O terceiro existe porque a chamada demora e o botão não
     pode aceitar um segundo clique nesse meio-tempo. */
  const [zona, setZona] = useState(false);
  const [palavra, setPalavra] = useState("");
  const [apagando, setApagando] = useState(false);
  const [erroApagar, setErroApagar] = useState<string | null>(null);
  const PALAVRA = "APAGAR";
  const [pic, setPic] = useState(avatar);
  const fileRef = useRef<HTMLInputElement>(null);

  /* undefined: ninguém mexeu na foto. null: pediu para remover.
     Blob: escolheu uma nova. Só o que mudou vai para o servidor. */
  const [foto, setFoto] = useState<Blob | null | undefined>(undefined);
  /* O endereço temporário da pré-visualização precisa ser devolvido ao
     navegador, senão o arquivo fica preso na memória da aba. */
  const previa = useRef<string | null>(null);
  const trocarPrevia = (url: string | undefined) => {
    if (previa.current) URL.revokeObjectURL(previa.current);
    previa.current = url ?? null;
    setPic(url);
  };
  useEffect(
    () => () => {
      if (previa.current) URL.revokeObjectURL(previa.current);
    },
    []
  );

  /* A URL assinada da foto chega depois da abertura do aplicativo. Quem
     abre esta folha antes disso veria o perfil sem foto, e sem o botão de
     remover, que só aparece quando existe imagem. Enquanto ninguém mexeu
     na foto aqui dentro, a tela segue o que o store está mostrando. */
  useEffect(() => {
    if (foto === undefined && !previa.current) setPic(avatar);
  }, [avatar, foto]);

  const [erroFoto, setErroFoto] = useState("");

  /** reduz a imagem para 256px antes de guardar, para não estourar o armazenamento */
  const pick = (file: File) => {
    /* Um arquivo gigante vira data URL inteiro na memória antes de encolher,
       o que trava a aba. Foto de perfil não precisa de mais que isso. */
    if (file.size > 8 * 1024 * 1024) {
      setErroFoto("Escolha uma imagem de até 8 MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErroFoto("Esse arquivo não é uma imagem.");
      return;
    }
    setErroFoto("");
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const side = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          size,
          size
        );
        /* Blob em vez de data URL: é o arquivo que vai para o Storage,
           e não uma string de base64 33% maior atravessando o banco. */
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              setErroFoto("Não consegui preparar essa imagem. Tente outra.");
              return;
            }
            setFoto(blob);
            trocarPrevia(URL.createObjectURL(blob));
          },
          "image/jpeg",
          0.85
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Sheet title="Seu perfil" onClose={onClose}>
      <div className="profile">
        {pic ? (
          <img className="profile__av" src={pic} alt="" />
        ) : (
          <span className="profile__av profile__av--letter">
            {(n || "V").charAt(0).toUpperCase()}
          </span>
        )}
        <div className="profile__acts">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
              e.target.value = "";
            }}
          />
          <button className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
            <Icon name="image" size={15} />
            Escolher foto
          </button>
          {pic && (
            <button
              className="minilink"
              onClick={() => {
                setFoto(null);
                trocarPrevia(undefined);
              }}
            >
              Remover foto
            </button>
          )}
        </div>
      </div>

      {erroFoto && (
        <p className="field__err" role="alert">
          {erroFoto}
        </p>
      )}

      <label className="field">
        <span>Nome</span>
        <input id="pf-nome" value={n} onChange={(e) => setN(e.target.value)} />
      </label>

      <label className="field">
        <span>E-mail</span>
        <input id="pf-email" value={email} disabled />
      </label>

      <button className="btn btn--pos" style={{ width: "100%" }} onClick={() => onSave(n, foto)}>
        Salvar perfil
      </button>

      {/* Apagar a conta é um direito da LGPD, então ele mora aqui dentro e
          não num e-mail que alguém precisa responder. Fica no fim, atrás de
          um toque e de uma palavra digitada: a fricção é proposital, porque
          isto não tem desfazer nenhum. */}
      <div className="perigo">
        {!zona ? (
          <button type="button" className="perigo__abrir" onClick={() => setZona(true)}>
            <Icon name="trash" size={14} />
            Apagar a minha conta
          </button>
        ) : (
          <div className="perigo__cx">
            <h3 className="perigo__t">
              <Icon name="alert" size={16} />
              Isto apaga tudo, e não tem volta
            </h3>
            <p className="perigo__d">
              Somem os seus lançamentos, categorias, séries, regras de importação, a sua
              foto e a conta em si. Ninguém consegue trazer de volta depois, nem eu.
            </p>
            <button type="button" className="minilink perigo__baixar" onClick={onExport}>
              <Icon name="download" size={13} />
              Baixar os meus dados antes
            </button>

            <label className="field perigo__campo">
              <span>
                Para confirmar, escreva <b>{PALAVRA}</b>
              </span>
              <input
                id="pf-apagar"
                value={palavra}
                onChange={(e) => {
                  setPalavra(e.target.value);
                  setErroApagar(null);
                }}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={PALAVRA}
              />
            </label>

            {erroApagar && (
              <p className="field__err" role="alert">
                {erroApagar}
              </p>
            )}

            <div className="perigo__acoes">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setZona(false);
                  setPalavra("");
                  setErroApagar(null);
                }}
                disabled={apagando}
              >
                Deixa pra lá
              </button>
              <button
                type="button"
                className="btn btn--sm perigo__ok"
                disabled={palavra.trim().toUpperCase() !== PALAVRA || apagando}
                onClick={async () => {
                  setApagando(true);
                  setErroApagar(null);
                  const r = await onApagarConta();
                  if (!r.ok) {
                    setApagando(false);
                    setErroApagar(r.error ?? "Não deu para apagar agora.");
                  }
                  /* Deu certo: a sessão caiu e a tela de entrar assume. Nada
                     de mexer no estado desta folha, que já está sendo
                     desmontada junto com o resto. */
                }}
              >
                {apagando ? "Apagando…" : "Apagar para sempre"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/* -------------------------- personalizar início -------------------------- */

function HomeSheet({
  current,
  onSave,
  onClose,
}: {
  current: string[];
  onSave: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(current);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const chosen = picked.map((id) => WIDGETS.find((w) => w.id === id)).filter(Boolean);
  const rest = WIDGETS.filter((w) => !picked.includes(w.id));

  return (
    <Sheet title="Sua tela inicial" onClose={onClose} wide>
      <p className="dim">
        O total gasto no mês fica sempre no topo. Escolha aqui quais blocos aparecem. Para
        mudar a ordem, segure um bloco na tela inicial e arraste.
      </p>

      {chosen.length > 0 && (
        <div className="picklist">
          <span className="picklist__h mono">Na sua tela</span>
          {chosen.map((w) => (
            <div className="picklist__row" key={w!.id}>
              <span className="picklist__txt">
                <strong>{w!.label}</strong>
                <span className="dim">{w!.hint}</span>
              </span>
              <button className="scr__tool" aria-label="Remover" onClick={() => toggle(w!.id)}>
                <Icon name="close" size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="picklist">
          <span className="picklist__h mono">Disponíveis</span>
          {rest.map((w) => (
            <button className="picklist__row picklist__row--add" key={w.id} onClick={() => toggle(w.id)}>
              <span className="picklist__txt">
                <strong>{w.label}</strong>
                <span className="dim">{w.hint}</span>
              </span>
              <span className="scr__tool">
                <Icon name="plus" size={15} />
              </span>
            </button>
          ))}
        </div>
      )}

      <button className="btn btn--pos" style={{ width: "100%" }} onClick={() => onSave(picked)}>
        Salvar tela inicial
      </button>
    </Sheet>
  );
}

/* ------------------------------ importação ------------------------------ */

function ImportSheet({
  result,
  nome,
  existentes,
  cats,
  regras,
  onConfirm,
  onClose,
}: {
  result: ImportResult;
  nome: string;
  existentes: Transaction[];
  cats: Category[];
  regras: Regra[];
  onConfirm: (
    rows: Omit<Transaction, "id">[],
    virarMovimentacao: string[],
    novasRegras: Regra[]
  ) => void;
  onClose: () => void;
}) {
  /* A triagem roda uma vez por arquivo. Ela não altera nada: só diz o que
     cada linha parece ser e por quê. Quem decide o que entra é a pessoa.
     O que a pessoa já ensinou entra por cima, e desfaz dúvida: a linha
     decidida no mês passado não pergunta de novo. */
  const triagem = useMemo(() => {
    const bruta = triar(
      result.rows.map((row, i) => ({ row, bruto: result.brutos?.[i] ?? row.description })),
      { nome, existentes }
    );
    const linhas = aplicarRegras(bruta.linhas, regras, cats);
    /* Se uma regra tirou do modo movimentação uma linha que era o outro
       lado de um lançamento já importado, o lançamento antigo não pode
       virar movimentação sozinho: um lado ficaria de fora da conta e o
       outro dentro. */
    const virarMovimentacao = bruta.virarMovimentacao.filter((id) =>
      linhas.some((l) => l.parNoApp === id && l.sugestao.natureza === "movimentacao")
    );
    return { linhas, virarMovimentacao };
  }, [result, nome, existentes, regras, cats]);

  /* O que a pessoa respondeu nas linhas em dúvida. */
  const [decidido, setDecidido] = useState<Record<number, Kind>>({});

  const natureza = (i: number): Kind =>
    decidido[i] ?? triagem.linhas[i].sugestao.natureza;

  const duvidas = triagem.linhas
    .map((l, i) => ({ l, i }))
    .filter(({ l, i }) => l.sugestao.certeza === "duvida" && decidido[i] === undefined);

  /* Entra tudo que não é movimentação e não está esperando decisão. A
     linha que a pessoa confirmou como gasto precisa aparecer aqui, senão
     a tela promete um número e importa outro. */
  const entram = triagem.linhas
    .map((l, i) => ({ l, i }))
    .filter(
      ({ l, i }) =>
        natureza(i) !== "movimentacao" &&
        !(l.sugestao.certeza === "duvida" && decidido[i] === undefined)
    );

  const fora = triagem.linhas
    .map((l, i) => ({ l, i }))
    .filter(({ i }) => natureza(i) === "movimentacao");

  const confirmar = () => {
    const rows = triagem.linhas.map((l, i) => ({ ...l.row, kind: natureza(i) }));
    const aprendidas = aprenderDaConferencia(
      triagem.linhas,
      decidido,
      new Date().toISOString()
    );
    onConfirm(rows, triagem.virarMovimentacao, aprendidas);
  };

  const linha = (l: (typeof triagem.linhas)[number], i: number, mostrarMotivo: boolean) => (
    <div className="preview__row" key={i}>
      <span className="num dim">{l.row.date.split("-").reverse().join("/")}</span>
      <span className="preview__d">
        {l.row.description}
        {mostrarMotivo && l.sugestao.motivo && (
          <span className="preview__m">{l.sugestao.motivo}</span>
        )}
      </span>
      <span
        className={`num ${
          natureza(i) === "movimentacao" ? "dim" : natureza(i) === "despesa" ? "v-neg" : "v-pos"
        }`}
      >
        {natureza(i) === "movimentacao" ? "" : natureza(i) === "despesa" ? "−" : "+"}
        {l.row.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </span>
    </div>
  );

  return (
    <Sheet title="Conferir o extrato" onClose={onClose}>
      {result.error ? (
        <>
          <p className="field__err">{result.error}</p>
          <p className="dim">
            Aceitamos o extrato original do banco em PDF, XLS, XLSX ou CSV. Ele precisa ter
            cabeçalho e, no mínimo, colunas de data e valor. Um extrato exportado pelo próprio
            Gastô sempre funciona.
          </p>
        </>
      ) : result.rows.length === 0 ? (
        <>
          <p className="dim">
            Todos os {result.duplicates} lançamentos deste arquivo já estavam no Gastô. Nada
            foi importado de novo.
          </p>
          <button className="btn btn--ghost" style={{ width: "100%" }} onClick={onClose}>
            Entendi
          </button>
        </>
      ) : (
        <>
          <div className="duo">
            <div className="duo__i duo__i--accent">
              <span className="duo__l">Entram como gasto ou receita</span>
              <span className="duo__v num">{entram.length}</span>
            </div>
            <div className="duo__i">
              <span className="duo__l">Ficam fora da conta do mês</span>
              <span className="duo__v num">{fora.length}</span>
            </div>
          </div>

          {Boolean(result.duplicates) && (
            <p className="dim">
              {result.duplicates === 1
                ? "Um lançamento do arquivo já existia no app e foi deixado de fora."
                : `${result.duplicates} lançamentos do arquivo já existiam no app e ficaram de fora.`}{" "}
              Você pode importar o mesmo extrato quantas vezes quiser sem duplicar nada.
            </p>
          )}

          {duvidas.length > 0 && (
            <div className="bloco bloco--duvida">
              <span className="bloco__t mono">Precisa de você</span>
              <p className="dim">
                {duvidas.length === 1
                  ? "Uma linha ficou em dúvida. O extrato não entra enquanto ela não for decidida."
                  : `${duvidas.length} linhas ficaram em dúvida. O extrato não entra enquanto elas não forem decididas.`}
              </p>
              {duvidas.map(({ l, i }) => (
                <div className="duvida" key={i}>
                  {linha(l, i, true)}
                  <div className="duvida__acoes">
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => setDecidido((d) => ({ ...d, [i]: l.row.kind }))}
                    >
                      {l.row.kind === "despesa" ? "É um gasto" : "É uma receita"}
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => setDecidido((d) => ({ ...d, [i]: "movimentacao" }))}
                    >
                      É transferência minha
                    </button>
                  </div>
                </div>
              ))}
              <p className="dim">
                O que você decidir aqui, o Gastô passa a lembrar: linha parecida no extrato
                do mês que vem já vem resolvida.
              </p>
              {duvidas.length > 1 && (
                <button
                  className="minilink"
                  onClick={() =>
                    setDecidido((d) => {
                      const novo = { ...d };
                      for (const { i } of duvidas) novo[i] = "movimentacao";
                      return novo;
                    })
                  }
                >
                  Todas são transferências minhas
                </button>
              )}
            </div>
          )}

          {fora.length > 0 && (
            <div className="bloco">
              <span className="bloco__t mono">Fica de fora da conta do mês</span>
              <p className="dim">
                Continua guardado e aparece na lista, só não conta como gasto nem como
                receita. Dá para mudar depois, lançamento por lançamento.
              </p>
              <div className="preview">
                {fora.map(({ l, i }) => (
                  <div key={i}>
                    {linha(l, i, true)}
                    <button
                      className="minilink"
                      onClick={() =>
                        setDecidido((d) => ({ ...d, [i]: l.direcao === "e" ? "receita" : "despesa" }))
                      }
                    >
                      Não, isto é {l.direcao === "e" ? "receita" : "gasto"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {triagem.virarMovimentacao.length > 0 && (
            <p className="dim">
              {triagem.virarMovimentacao.length === 1
                ? "Um lançamento que já estava aqui é o outro lado de uma dessas transferências, e vai virar movimentação junto."
                : `${triagem.virarMovimentacao.length} lançamentos que já estavam aqui são o outro lado dessas transferências, e vão virar movimentação junto.`}
            </p>
          )}

          {result.newCategories.length > 0 && (
            <p className="dim">
              Vamos criar {result.newCategories.length}{" "}
              {result.newCategories.length === 1 ? "categoria nova" : "categorias novas"}:{" "}
              {result.newCategories.map((c) => c.label).join(", ")}.
            </p>
          )}

          {entram.length > 0 && (
            <div className="bloco">
              <span className="bloco__t mono">Entra no mês</span>
              <div className="preview">
                {entram.slice(0, 6).map(({ l, i }) => linha(l, i, false))}
                {entram.length > 6 && (
                  <p className="dim" style={{ padding: "8px 2px 0" }}>
                    e mais {entram.length - 6}…
                  </p>
                )}
              </div>
            </div>
          )}

          <button
            className="btn btn--pos"
            style={{ width: "100%" }}
            onClick={confirmar}
            disabled={duvidas.length > 0}
          >
            {duvidas.length > 0
              ? `Faltam ${duvidas.length} ${duvidas.length === 1 ? "linha" : "linhas"} para você decidir`
              : `Importar ${result.rows.length} ${result.rows.length === 1 ? "lançamento" : "lançamentos"}`}
          </button>
        </>
      )}
    </Sheet>
  );
}
