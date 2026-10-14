import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

/* ------------------------------------------------------------------
   Pergunta antes de apagar.

   Apagar lançamento não tem desfazer, então tudo que destrói dado passa
   por aqui. O texto diz exatamente o que vai sumir e quantos itens são,
   porque "tem certeza?" sozinho não ajuda ninguém a decidir.

   O foco começa no botão de cancelar de propósito: quem apertou sem
   querer e continua batendo Enter não perde nada.
-------------------------------------------------------------------*/

export interface Pergunta {
  titulo: string;
  texto: string;
  /** rótulo do botão que confirma, no imperativo: "Apagar os 12 lançamentos" */
  rotulo: string;
  acao: () => void;
}

export function Confirm({ pergunta, onClose }: { pergunta: Pergunta; onClose: () => void }) {
  const cancelarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelarRef.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onClose]);

  return (
    <div className="confirm" role="dialog" aria-modal="true" aria-label={pergunta.titulo}>
      <button className="confirm__scrim" aria-label="Fechar" onClick={onClose} />
      <div className="confirm__box">
        <span className="confirm__selo" aria-hidden="true">
          <Icon name="alert" size={20} />
        </span>
        <h2>{pergunta.titulo}</h2>
        <p>{pergunta.texto}</p>
        <div className="confirm__acts">
          <button ref={cancelarRef} className="btn btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn--danger"
            onClick={() => {
              pergunta.acao();
              onClose();
            }}
          >
            <Icon name="trash" size={15} />
            {pergunta.rotulo}
          </button>
        </div>
      </div>
    </div>
  );
}
