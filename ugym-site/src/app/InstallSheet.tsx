import { useState } from "react";
import { Icon } from "../components/Icon";
import { PASSOS_INSTALAR, aparelhoProvavel, type Aparelho } from "../lib/instalar";

/* ------------------------------------------------------------------
   Instalar na tela inicial.

   O mesmo passo a passo que está no site, aqui dentro para quem já
   entrou e continua abrindo o Gastô pelo navegador.
-------------------------------------------------------------------*/

export function InstallSheet({ onClose }: { onClose: () => void }) {
  const [qual, setQual] = useState<Aparelho>(aparelhoProvavel);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Instalar no celular">
      <button className="sheet__scrim" aria-label="Fechar" onClick={onClose} />
      <div className="sheet__panel">
        <div className="sheet__head">
          <h2>Deixar o Gastô no celular</h2>
          <button type="button" className="scr__tool" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="stack">
          <p className="dim">
            Dá para colocar o Gastô na tela inicial do seu celular, com ícone próprio e sem a
            barra do navegador. Não baixa nada de loja nenhuma e não ocupa espaço.
          </p>

          <div className="seg seg--block seg--ink" role="tablist">
            <button
              type="button"
              className="seg__i"
              role="tab"
              aria-selected={qual === "iphone"}
              onClick={() => setQual("iphone")}
            >
              iPhone
            </button>
            <button
              type="button"
              className="seg__i"
              role="tab"
              aria-selected={qual === "android"}
              onClick={() => setQual("android")}
            >
              Android
            </button>
          </div>

          <ol className="passos">
            {PASSOS_INSTALAR[qual].map((p, i) => (
              <li className="passos__i" key={p}>
                <span className="passos__n num">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>

          <button className="btn btn--pos" style={{ width: "100%" }} onClick={onClose}>
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
