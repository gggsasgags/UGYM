import { useEffect, useRef, useState } from "react";
import { Icon } from "../components/Icon";
import { HomeWidget } from "./widgets";
import { WIDGETS } from "../lib/home";
import type { Category, Transaction } from "../lib/types";

/* ------------------------------------------------------------------
   Reorganizar os blocos da tela inicial, no estilo do iPhone.

   Segurar um bloco por um instante entra no modo de edição: os blocos
   levantam, ganham o X e passam a ser arrastáveis. Enquanto edita, o
   conteúdo de dentro fica inerte, senão arrastar o calendário abriria
   o dia em vez de mover o bloco.

   O gesto usa Pointer Events, então o mesmo código serve para mouse e
   para toque, sem biblioteca.
-------------------------------------------------------------------*/

const SEGURAR_MS = 420;
/** quanto o dedo pode tremer antes de deixar de ser um "segurar" */
const TOLERANCIA = 8;

interface Props {
  ids: string[];
  tx: Transaction[];
  ym: string;
  cats: Category[];
  today?: string;
  onReorder?: (ids: string[]) => void;
  onRemove?: (id: string) => void;
  onAdd?: () => void;
}

export function HomeGrid({ ids, tx, ym, cats, today, onReorder, onRemove, onAdd }: Props) {
  const editavel = Boolean(onReorder);
  const [editando, setEditando] = useState(false);
  const [ordem, setOrdem] = useState(ids);
  const [pegando, setPegando] = useState<string | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const partida = useRef<{ x: number; y: number } | null>(null);
  const arrastando = useRef(false);
  const ordemRef = useRef(ordem);
  ordemRef.current = ordem;

  // a ordem salva manda enquanto ninguém está arrastando
  useEffect(() => {
    if (!arrastando.current) setOrdem(ids);
  }, [ids]);

  useEffect(() => {
    if (!editando) return;
    const sair = (e: KeyboardEvent) => e.key === "Escape" && setEditando(false);
    window.addEventListener("keydown", sair);
    return () => window.removeEventListener("keydown", sair);
  }, [editando]);

  const limparTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  /** índice do bloco sob o ponteiro, pelo retângulo de cada um */
  const alvoSob = (x: number, y: number) => {
    const host = hostRef.current;
    if (!host) return -1;
    const blocos = [...host.querySelectorAll<HTMLElement>("[data-widget]")];
    for (let i = 0; i < blocos.length; i++) {
      const r = blocos[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
    }
    return -1;
  };

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {
    if (!editavel || e.button === 2) return;
    partida.current = { x: e.clientX, y: e.clientY };

    if (editando) {
      iniciarArraste(id, e);
      return;
    }
    // fora do modo de edição, só entra se segurar
    limparTimer();
    timer.current = window.setTimeout(() => {
      setEditando(true);
      if (navigator.vibrate) navigator.vibrate(12);
    }, SEGURAR_MS);
  };

  const iniciarArraste = (id: string, e: React.PointerEvent) => {
    arrastando.current = true;
    setPegando(id);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (partida.current && !arrastando.current) {
      const d =
        Math.abs(e.clientX - partida.current.x) + Math.abs(e.clientY - partida.current.y);
      if (d > TOLERANCIA) limparTimer(); // rolou a página, não é um "segurar"
    }
    if (!arrastando.current || !pegando) return;
    e.preventDefault();

    const de = ordemRef.current.indexOf(pegando);
    const para = alvoSob(e.clientX, e.clientY);
    if (para < 0 || para === de) return;

    const proxima = [...ordemRef.current];
    proxima.splice(para, 0, ...proxima.splice(de, 1));
    setOrdem(proxima);
  };

  const encerrar = () => {
    limparTimer();
    partida.current = null;
    if (arrastando.current) {
      arrastando.current = false;
      setPegando(null);
      onReorder?.(ordemRef.current);
    }
  };

  const disponiveis = WIDGETS.filter((w) => !ordem.includes(w.id)).length;

  return (
    <>
      <div
        className="homegrid"
        ref={hostRef}
        data-editing={editando || undefined}
        onPointerMove={onPointerMove}
        onPointerUp={encerrar}
        onPointerCancel={encerrar}
      >
        {ordem.map((id) => (
          <div
            className={`homegrid__i${WIDGETS.find((w) => w.id === id)?.wide ? " span2" : ""}`}
            key={id}
            data-widget={id}
            data-held={pegando === id || undefined}
            onPointerDown={onPointerDown(id)}
            onContextMenu={(e) => editando && e.preventDefault()}
          >
            {editando && onRemove && (
              <button
                className="homegrid__x"
                aria-label={`Tirar ${WIDGETS.find((w) => w.id === id)?.label ?? id} da tela`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const proxima = ordem.filter((x) => x !== id);
                  setOrdem(proxima);
                  onReorder?.(proxima);
                  onRemove(id);
                }}
              >
                <Icon name="close" size={14} />
              </button>
            )}
            {editando && (
              <span className="homegrid__grip" aria-hidden="true">
                <Icon name="menu" size={14} />
              </span>
            )}
            <HomeWidget id={id} tx={tx} ym={ym} cats={cats} today={today} />
          </div>
        ))}
      </div>

      {editavel && editando ? (
        <div className="editbar span2" role="toolbar" aria-label="Editando a tela inicial">
          <span className="editbar__hint">
            Arraste os blocos para trocar de lugar
            {disponiveis > 0 ? `, ou adicione mais ${disponiveis === 1 ? "um" : disponiveis}` : ""}.
          </span>
          <div className="editbar__acts">
            {disponiveis > 0 && onAdd && (
              <button className="btn btn--ghost btn--sm" onClick={onAdd}>
                <Icon name="plus" size={15} />
                Adicionar
              </button>
            )}
            <button className="btn btn--pos btn--sm" onClick={() => setEditando(false)}>
              Pronto
            </button>
          </div>
        </div>
      ) : (
        editavel && (
          <button className="customize span2" onClick={() => setEditando(true)}>
            <Icon name="spark" size={15} />
            Escolher o que aparece aqui
          </button>
        )
      )}
    </>
  );
}
