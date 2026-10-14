/**
 * O terceiro tipo existe porque nem tudo que sai da conta é gasto.
 * Transferência entre contas da mesma pessoa e dinheiro que foi para
 * aplicação são o mesmo dinheiro mudando de lugar: ficam guardados,
 * aparecem na lista, e ficam fora de toda conta do mês e da nota.
 */
export type Kind = "despesa" | "receita" | "movimentacao";
export type Recurrence = "fixo" | "variavel";

export interface Category {
  id: string;
  label: string;
  emoji: string;
  kind: Kind;
  /** categorias base não podem ser apagadas, só editadas */
  base?: boolean;
}

export interface Transaction {
  id: string;
  description: string;
  /** sempre positivo; o sinal vem de `kind` */
  amount: number;
  kind: Kind;
  category: string;
  /** ISO yyyy-mm-dd */
  date: string;
  recurrence: Recurrence;
  installment?: { current: number; total: number };
  /** liga o lançamento à série que o gerou (fixo mensal ou parcelamento) */
  seriesId?: string;
}

/** modelo que gera lançamentos em vários meses */
export interface Series {
  id: string;
  kind: "mensal" | "parcelado";
  startYM: string;
  total?: number;
  endedYM?: string;
  template: {
    description: string;
    amount: number;
    kind: Kind;
    category: string;
    recurrence: Recurrence;
    day: number;
  };
}

export interface Account {
  id: string;
  name: string;
  email: string;
  /* Senha é responsabilidade do Supabase Auth. Estes dois campos
     sobraram da versão que guardava tudo no navegador e continuam
     opcionais só para não quebrar quem ainda os preenche. */
  salt?: string;
  hash?: string;
  createdAt: string;
  /**
   * Endereço da foto para a tela, e não o que está guardado no banco: a
   * coluna tem o caminho no Storage, aqui vem a URL assinada, a prévia
   * `blob:` de uma foto recém-escolhida ou o base64 de quem ainda não migrou.
   */
  avatar?: string;
}

export interface Ledger {
  transactions: Transaction[];
  series: Series[];
  /** ocorrências apagadas à mão: `${seriesId}@${yyyy-mm}` */
  skips: string[];
  categories: Category[];
  /** blocos da tela inicial, na ordem escolhida */
  home: string[];
  /** aparência do aplicativo */
  theme: "claro" | "escuro";
  /** calculadora flutuante ligada */
  calc: boolean;
}
