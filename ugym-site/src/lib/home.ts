/** Blocos que o usuário pode ligar, desligar e reordenar na tela inicial. */

export interface WidgetDef {
  id: string;
  label: string;
  hint: string;
  /** ocupa as duas colunas em tela larga */
  wide?: boolean;
}

export const WIDGETS: WidgetDef[] = [
  {
    id: "calendar",
    label: "Calendário de gastos",
    hint: "Os dias do mês acendem em verde conforme o quanto foi gasto em cada um.",
  },
  {
    id: "categories",
    label: "Gastos por categoria",
    hint: "Ranking das categorias do mês, da maior para a menor.",
  },
  {
    id: "split",
    label: "Fixos e variáveis",
    hint: "Quanto do mês já estava comprometido e quanto foi decisão sua.",
  },
  {
    id: "pace",
    label: "Ritmo do mês",
    hint: "Média por dia e projeção de fechamento se o ritmo continuar.",
  },
  {
    id: "trend",
    label: "Evolução dos gastos",
    hint: "Comparação dos últimos seis meses em uma barra por mês.",
    wide: true,
  },
  {
    id: "top",
    label: "Maiores gastos do mês",
    hint: "Os cinco lançamentos que mais pesaram.",
  },
  {
    id: "weekday",
    label: "Dias da semana",
    hint: "Em quais dias da semana você costuma gastar mais.",
  },
  {
    id: "installments",
    label: "Parcelamentos em aberto",
    hint: "Quantas parcelas faltam e quanto ainda falta pagar.",
  },
  {
    id: "fixed",
    label: "Compromissos fixos",
    hint: "A lista dos fixos do mês, do maior para o menor.",
  },
  {
    id: "compare",
    label: "Comparação com o mês passado",
    hint: "Quanto subiu ou caiu em cada categoria.",
  },
];

export const DEFAULT_HOME = ["calendar", "categories", "split", "pace"];
