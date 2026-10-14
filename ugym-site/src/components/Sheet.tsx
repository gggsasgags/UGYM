import { useEffect } from "react";
import { Icon } from "./Icon";

/* ------------------------------------------------------------------
   A folha genérica do aplicativo.

   Ela morava dentro do AppShell, que era onde tinha nascido. Saiu para cá
   quando os widgets da tela inicial passaram a abrir folha também: o
   AppShell importa as telas, então uma tela importando o AppShell fecharia
   um ciclo. O componente não mudou, só mudou de casa.
-------------------------------------------------------------------*/

export function Sheet({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet__scrim" aria-label="Fechar" onClick={onClose} />
      <div className={`sheet__panel${wide ? " sheet__panel--wide" : ""}`}>
        <div className="sheet__head">
          <h2>{title}</h2>
          <button type="button" className="scr__tool" onClick={onClose} aria-label="Fechar">
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
