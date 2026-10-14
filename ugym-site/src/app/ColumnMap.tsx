import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { aplicarMapa, type ImportResult, type Mapa, type Tabela } from "../lib/statements";
import type { Category } from "../lib/types";

/* ------------------------------------------------------------------
   Conferir as colunas do extrato antes de importar.

   Cada banco exporta com um nome diferente de coluna, e alguns nem
   cabeçalho decente têm. Em vez de o Gastô errar em silêncio, esta tela
   mostra o que ele entendeu, deixa trocar cada coluna e descartar as
   que não interessam. A prévia embaixo é recalculada pela mesma função
   que faz a importação de verdade, então o que aparece ali é o que vai
   entrar na carteira.
-------------------------------------------------------------------*/

const NENHUMA = -1;

/* Fica fora do componente de propósito: definido lá dentro, ele seria um
   tipo novo a cada render e o <select> fecharia sozinho ao ser usado. */
function Seletor({
  rotulo,
  valor,
  cabecalho,
  ignoradas,
  dica,
  opcional,
  onChange,
}: {
  rotulo: string;
  valor: number;
  cabecalho: string[];
  ignoradas: number[];
  dica?: string;
  opcional?: boolean;
  onChange: (i: number) => void;
}) {
  return (
    <label className="field">
      <span>
        {rotulo}
        {opcional && <span className="colmap__opc"> opcional</span>}
      </span>
      <select value={valor} onChange={(e) => onChange(Number(e.target.value))}>
        <option value={NENHUMA}>{opcional ? "Não tem no arquivo" : "Escolha a coluna"}</option>
        {cabecalho.map((h, i) =>
          ignoradas.includes(i) ? null : (
            <option key={i} value={i}>
              {h}
            </option>
          )
        )}
      </select>
      {dica && <span className="field__hint">{dica}</span>}
    </label>
  );
}

interface Props {
  tabela: Tabela;
  source: string;
  cats: Category[];
  onPronto: (r: ImportResult) => void;
  onClose: () => void;
}

export function ColumnMap({ tabela, source, cats, onPronto, onClose }: Props) {
  const [mapa, setMapa] = useState<Mapa>(tabela.mapa);
  const [doisCampos, setDoisCampos] = useState(
    tabela.mapa.credito >= 0 || tabela.mapa.debito >= 0
  );

  const previa = useMemo(
    () => aplicarMapa(tabela, mapa, cats, source),
    [tabela, mapa, cats, source]
  );

  const trocar = (campo: keyof Omit<Mapa, "ignoradas">, valor: number) =>
    setMapa((m) => ({ ...m, [campo]: valor, ignoradas: m.ignoradas.filter((i) => i !== valor) }));

  const alternarIgnorada = (i: number) =>
    setMapa((m) => {
      const fora = m.ignoradas.includes(i);
      const ignoradas = fora ? m.ignoradas.filter((x) => x !== i) : [...m.ignoradas, i];
      if (fora) return { ...m, ignoradas };
      /* Descartar uma coluna que estava sendo usada limpa o papel dela,
         senão a prévia ficaria dizendo que usa algo que foi jogado fora. */
      const limpo = { ...m, ignoradas };
      for (const campo of ["data", "descricao", "valor", "credito", "debito", "categoria"] as const) {
        if (limpo[campo] === i) limpo[campo] = NENHUMA;
      }
      return limpo;
    });

  const usada = (i: number) =>
    [mapa.data, mapa.descricao, mapa.valor, mapa.credito, mapa.debito, mapa.categoria].includes(i);

  const faltaEssencial =
    mapa.data < 0 || (mapa.valor < 0 && mapa.credito < 0 && mapa.debito < 0);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Conferir as colunas">
      <button className="sheet__scrim" aria-label="Fechar" onClick={onClose} />
      <div className="sheet__panel sheet__panel--wide">
        <div className="sheet__head">
          <h2>Confira as colunas</h2>
          <button type="button" className="scr__tool" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="stack">
          <p className="dim">
            Isto é o que lemos do seu arquivo {source}. Ajuste o que estiver trocado e descarte
            o que não interessa. A prévia embaixo mostra o resultado de verdade.
          </p>

          <div className="colmap__campos">
            <Seletor rotulo="Data" valor={mapa.data} cabecalho={tabela.cabecalho} ignoradas={mapa.ignoradas} onChange={(i) => trocar("data", i)} />
            <Seletor rotulo="Descrição" opcional valor={mapa.descricao} cabecalho={tabela.cabecalho} ignoradas={mapa.ignoradas} onChange={(i) => trocar("descricao", i)} />
          </div>

          <div className="field">
            <span>Como o valor está no arquivo</span>
            <div className="seg seg--block" role="tablist">
              <button
                type="button"
                className="seg__i"
                role="tab"
                aria-selected={!doisCampos}
                onClick={() => {
                  setDoisCampos(false);
                  setMapa((m) => ({ ...m, credito: NENHUMA, debito: NENHUMA }));
                }}
              >
                Uma coluna só
              </button>
              <button
                type="button"
                className="seg__i"
                role="tab"
                aria-selected={doisCampos}
                onClick={() => {
                  setDoisCampos(true);
                  setMapa((m) => ({ ...m, valor: NENHUMA }));
                }}
              >
                Entrada e saída
              </button>
            </div>
          </div>

          {doisCampos ? (
            <div className="colmap__campos">
              <Seletor rotulo="Entrada" dica="Receitas" opcional valor={mapa.credito} cabecalho={tabela.cabecalho} ignoradas={mapa.ignoradas} onChange={(i) => trocar("credito", i)} />
              <Seletor rotulo="Saída" dica="Despesas" opcional valor={mapa.debito} cabecalho={tabela.cabecalho} ignoradas={mapa.ignoradas} onChange={(i) => trocar("debito", i)} />
            </div>
          ) : (
            <Seletor
              rotulo="Valor"
              dica="Valores negativos viram despesa, positivos viram receita."
              valor={mapa.valor}
              cabecalho={tabela.cabecalho}
              ignoradas={mapa.ignoradas}
              onChange={(i) => trocar("valor", i)}
            />
          )}

          <Seletor
            rotulo="Categoria"
            opcional
            dica="Sem isso o Gastô adivinha a categoria pela descrição."
            valor={mapa.categoria}
            cabecalho={tabela.cabecalho}
            ignoradas={mapa.ignoradas}
            onChange={(i) => trocar("categoria", i)}
          />

          <div className="field">
            <span>Colunas do arquivo</span>
            <span className="field__hint" style={{ marginTop: 0 }}>
              Toque para descartar uma coluna. Descartada, ela não é usada em nada.
            </span>
            <div className="colmap__chips">
              {tabela.cabecalho.map((h, i) => {
                const fora = mapa.ignoradas.includes(i);
                return (
                  <button
                    type="button"
                    key={i}
                    className="colmap__chip"
                    data-off={fora || undefined}
                    data-on={(!fora && usada(i)) || undefined}
                    onClick={() => alternarIgnorada(i)}
                  >
                    <Icon name={fora ? "close" : "check"} size={12} />
                    {h}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="colmap__previa">
            <div className="colmap__previa__h">
              <strong>Prévia</strong>
              <span className="dim">
                {previa.error
                  ? "nada legível"
                  : `${previa.rows.length} ${previa.rows.length === 1 ? "linha" : "linhas"}${
                      previa.skipped ? `, ${previa.skipped} fora` : ""
                    }`}
              </span>
            </div>
            {previa.error ? (
              <p className="field__err">{previa.error}</p>
            ) : (
              <div className="preview">
                {previa.rows.slice(0, 5).map((r, i) => (
                  <div className="preview__row" key={i}>
                    <span className="num dim">{r.date.split("-").reverse().join("/")}</span>
                    <span className="preview__d">{r.description}</span>
                    <span className={`num ${r.kind === "despesa" ? "v-neg" : "v-pos"}`}>
                      {r.kind === "despesa" ? "−" : "+"}
                      {r.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {faltaEssencial && (
            <p className="field__err">
              Para importar, o Gastô precisa saber pelo menos qual coluna é a data e qual é o
              valor.
            </p>
          )}

          <button
            className="btn btn--pos"
            style={{ width: "100%" }}
            disabled={faltaEssencial || Boolean(previa.error)}
            onClick={() => onPronto(previa)}
          >
            Continuar com {previa.rows.length}{" "}
            {previa.rows.length === 1 ? "lançamento" : "lançamentos"}
          </button>
        </div>
      </div>
    </div>
  );
}
