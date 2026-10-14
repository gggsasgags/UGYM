import type { CSSProperties } from "react";
import { Icon, type IconName } from "../components/Icon";
import { LogoMark } from "../components/Logo";
import { monthLabel, shiftMonth } from "../lib/format";
import type { Account, Category, Transaction } from "../lib/types";
import {
  HomeScreen,
  InsightsScreen,
  SummaryScreen,
  TransactionsScreen,
} from "../screens/Screens";

export const TABS: { id: string; label: string; icon: IconName }[] = [
  { id: "inicio", label: "Início", icon: "inicio" },
  { id: "lancamentos", label: "Lançamentos", icon: "lancamentos" },
  { id: "resumo", label: "Resumo", icon: "resumo" },
  { id: "analises", label: "Análises", icon: "analises" },
];

/** O app de verdade rodando dentro da moldura, com as abas navegáveis. */
export function PhoneApp({
  tab,
  onTab,
  tx,
  ym,
  cats,
  account,
  home,
  totalShown,
}: {
  tab: string;
  onTab?: (id: string) => void;
  tx: Transaction[];
  ym: string;
  cats: Category[];
  account: Account;
  home: string[];
  totalShown?: number;
}) {
  const props = { tx, ym, cats, account, home, totalShown };

  return (
    <div className="pfone">
      <div className="pfone__view">
        {tab === "lancamentos" ? (
          <TransactionsScreen {...props} />
        ) : tab === "resumo" ? (
          <SummaryScreen {...props} />
        ) : tab === "analises" ? (
          <InsightsScreen {...props} />
        ) : (
          <HomeScreen {...props} />
        )}
      </div>

      {/* A pílula embaixo desliza de uma aba para a outra em vez de piscar
          no lugar certo. É o app navegando, e não quatro capturas. */}
      <nav
        className="pfone__tabs"
        aria-label="Seções do aplicativo"
        style={{ "--aba": Math.max(0, TABS.findIndex((t) => t.id === tab)) } as CSSProperties}
      >
        <span className="pfone__pilula" aria-hidden="true" />
        {TABS.map((t) => (
          <button
            key={t.id}
            className="pfone__tab"
            aria-selected={t.id === tab}
            role="tab"
            onClick={() => onTab?.(t.id)}
            tabIndex={onTab ? 0 : -1}
          >
            <Icon name={t.icon} size={20} stroke={t.id === tab ? 1.9 : 1.6} />
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Tela de bloqueio no padrão do iPhone, com a notificação do Gastô. */
export function LockScreen({ ym }: { ym: string }) {
  const next = shiftMonth(ym, 1);
  const [y, m] = next.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  const dia = d.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const mes = monthLabel(ym).split(" ")[0].toLowerCase();

  return (
    <div className="lock">
      {/* A barra de status já vem desenhada na moldura do aparelho. Desenhar
          outra aqui fazia a hora aparecer duas vezes, uma por cima da outra. */}
      <div className="lock__padlock">
        <Icon name="lock" size={17} stroke={2} />
      </div>

      <div className="lock__date">{dia}</div>
      <div className="lock__time num">9:41</div>

      <div className="lock__notes">
        <div className="lock__note">
          <span className="lock__ic">
            <LogoMark size={21} ink="#fff" />
          </span>
          <span className="lock__txt">
            <span className="lock__head">
              <strong>GASTÔ</strong>
              <span>agora</span>
            </span>
            <span className="lock__title">Seu relatório de {mes} está pronto</span>
            <span className="lock__body">
              Você fechou o mês com nota 6,1. Toque para ver o que puxou a nota.
            </span>
          </span>
        </div>
      </div>

      <div className="lock__actions">
        <span className="lock__round">
          <Icon name="lanterna" size={19} stroke={1.9} />
        </span>
        <span className="lock__round">
          <Icon name="camera" size={19} stroke={1.9} />
        </span>
      </div>

      <span className="lock__bar" />
    </div>
  );
}
