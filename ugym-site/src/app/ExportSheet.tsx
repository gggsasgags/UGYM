import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { money } from "../lib/format";
import { exportarPlanilha, filtrarMeses, mesesDisponiveis } from "../lib/exportar";
import type { Category, Transaction } from "../lib/types";

/* ------------------------------------------------------------------
   Escolher o que vai para a planilha antes de exportar.

   Exportar tudo sempre não serve: quem quer mandar o extrato de um mês
   para alguém não quer entregar o ano inteiro junto. Aqui a pessoa marca
   os meses, vê quantos lançamentos vão no arquivo e só então baixa.

   O mês que está aberto na tela já vem marcado, porque é o mais provável.
-------------------------------------------------------------------*/

interface Props {
  tx: Transaction[];
  cats: Category[];
  mesAtual: string;
  onClose: () => void;
  onAviso: (texto: string) => void;
}

export function ExportSheet({ tx, cats, mesAtual, onClose, onAviso }: Props) {
  const meses = useMemo(() => mesesDisponiveis(tx), [tx]);
  const [marcados, setMarcados] = useState<string[]>(() =>
    meses.some((m) => m.ym === mesAtual) ? [mesAtual] : meses.slice(0, 1).map((m) => m.ym)
  );
  const [baixando, setBaixando] = useState(false);

  const alternar = (ym: string) =>
    setMarcados((atual) =>
      atual.includes(ym) ? atual.filter((x) => x !== ym) : [...atual, ym]
    );

  const todos = marcados.length === meses.length;
  const selecionados = useMemo(() => filtrarMeses(tx, marcados), [tx, marcados]);
  const despesas = selecionados
    .filter((t) => t.kind === "despesa")
    .reduce((s, t) => s + t.amount, 0);

  const baixar = async () => {
    setBaixando(true);
    const ordenados = [...marcados].sort();
    const nome =
      ordenados.length === 1
        ? `gasto-${ordenados[0]}`
        : `gasto-${ordenados[0]}-a-${ordenados[ordenados.length - 1]}`;
    const formato = await exportarPlanilha(selecionados, cats, nome);
    setBaixando(false);
    if (formato === "csv") {
      onAviso("Não conseguimos montar a planilha, então baixamos em CSV. Seus dados estão lá.");
    }
    onClose();
  };

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Exportar">
      <button className="sheet__scrim" aria-label="Fechar" onClick={onClose} />
      <div className="sheet__panel">
        <div className="sheet__head">
          <h2>Exportar</h2>
          <button type="button" className="scr__tool" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="stack">
          <div className="exp__topo">
            <p className="dim">Escolha os meses que vão para a planilha.</p>
            <button
              type="button"
              className="minilink"
              onClick={() => setMarcados(todos ? [] : meses.map((m) => m.ym))}
            >
              {todos ? "Limpar" : "Marcar todos"}
            </button>
          </div>

          <div className="exp__lista">
            {meses.map((m) => {
              const on = marcados.includes(m.ym);
              return (
                <button
                  type="button"
                  key={m.ym}
                  className="exp__mes"
                  aria-pressed={on}
                  onClick={() => alternar(m.ym)}
                >
                  <span className="exp__marca" aria-hidden="true">
                    {on && <Icon name="check" size={14} />}
                  </span>
                  <span className="exp__id">
                    <strong>{m.rotulo}</strong>
                    <span>
                      {m.lancamentos} {m.lancamentos === 1 ? "lançamento" : "lançamentos"}
                    </span>
                  </span>
                  <span className="exp__val num">{money(m.despesas)}</span>
                </button>
              );
            })}
          </div>

          <div className="duo">
            <div className="duo__i duo__i--accent">
              <span className="duo__l">Vão no arquivo</span>
              <span className="duo__v num">{selecionados.length}</span>
            </div>
            <div className="duo__i">
              <span className="duo__l">Total de despesas</span>
              <span className="duo__v num">{money(despesas)}</span>
            </div>
          </div>

          <p className="dim">
            Sai em Excel, com as colunas já na largura certa e o valor como número, pronto para
            somar e filtrar.
          </p>

          <button
            className="btn btn--pos"
            style={{ width: "100%" }}
            disabled={!marcados.length || baixando}
            onClick={baixar}
          >
            {baixando ? (
              "Montando a planilha…"
            ) : (
              <>
                <Icon name="download" size={16} />
                Baixar {marcados.length}{" "}
                {marcados.length === 1 ? "mês" : "meses"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
