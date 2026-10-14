import { Icon } from "./Icon";
import { Foto } from "./Foto";
import { LogoMark } from "./Logo";
import { monthLabel } from "../lib/format";
import type { Account } from "../lib/types";

/** Cartão compacto de compartilhamento, aberto ao tocar na nota do perfil. */
export function ShareCard({
  account,
  score,
  tier,
  ym,
  onClose,
}: {
  account: Account | null;
  score: number;
  tier: string;
  ym: string;
  onClose: () => void;
}) {
  const initial = (account?.name ?? "V").charAt(0).toUpperCase();

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Cartão do mês">
      <button className="sheet__scrim" aria-label="Fechar" onClick={onClose} />
      <div className="sharewrap">
        <div className="share">
          <div className="share__glow" aria-hidden="true" />

          <div className="share__top">
            <LogoMark size={22} ink="#fff" />
            <span className="share__at">@usegasto</span>
          </div>

          <div className="share__who">
            <Foto
              src={account?.avatar}
              letra={initial}
              className="share__av"
              classNameLetra="share__av share__av--letter"
            />
            <span className="share__id">
              <strong>{account?.name}</strong>
              <span>{account?.email}</span>
            </span>
          </div>

          <div className="share__score">
            <span className="share__n num">
              {score.toLocaleString("pt-BR", { minimumFractionDigits: 1 })}
            </span>
            <span className="share__meta">
              <span className="share__tier">{tier}</span>
              <span className="share__m">{monthLabel(ym)}</span>
            </span>
          </div>

          <p className="share__foot">Nota do mês no Gastô, de 0 a 10.</p>
        </div>

        <button className="share__close" onClick={onClose}>
          <Icon name="close" size={15} />
          Fechar
        </button>
      </div>
    </div>
  );
}
