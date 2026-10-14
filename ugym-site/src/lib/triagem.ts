import type { Transaction } from "./types";

/* ------------------------------------------------------------------
   Triagem do extrato: separar gasto de movimentação.

   O extrato do banco não sabe a diferença entre gastar e mover. Toda
   linha que sai parece gasto, mas existem três saídas bem diferentes:
   dinheiro que virou consumo, dinheiro que só trocou de banco e dinheiro
   que foi guardado. Só a primeira é gasto.

   Sem isso, quem tem duas contas vê o mês inflado dos dois lados: a
   transferência conta como gasto no banco que enviou e como receita no
   banco que recebeu. O mesmo dinheiro, contado duas vezes.

   Aqui não existe adivinhação estatística, e sim três sinais que o
   extrato entrega de graça, do mais confiável para o menos:

   1. O espelho. Saiu 400 de um lado e entrou 400 do outro, no mesmo dia
      ou no dia seguinte. É o sinal mais forte que existe, porque não
      depende de ler nome nenhum.
   2. O nome do titular. "Enviado para DIEGO SOARES VIEIRA" quando a
      conta é do Diego Soares. Funciona mesmo com um banco só.
   3. O vocabulário de aplicação. Caixinha, resgate, CDB, tesouro. Cada
      banco tem o seu, e ele não muda de mês para mês.

   Quando o sinal é parcial, a linha não é classificada: ela vira dúvida
   e a pessoa decide. Importar errado é pior do que perguntar.
-------------------------------------------------------------------*/

export type Natureza = Transaction["kind"];

export interface Sugestao {
  natureza: Natureza;
  /** frase curta que aparece na tela, do lado da linha */
  motivo: string;
  /** `duvida` trava a importação até a pessoa decidir */
  certeza: "alta" | "duvida";
}

export interface Triada {
  row: Omit<Transaction, "id">;
  /** descrição como veio do banco, antes da limpeza */
  bruto: string;
  /** sentido original da linha no extrato: "s" saiu, "e" entrou */
  direcao: "e" | "s";
  sugestao: Sugestao;
  /** índice da linha deste mesmo arquivo que forma o par */
  parNoArquivo?: number;
  /** id do lançamento já importado que forma o par */
  parNoApp?: string;
}

export interface Contexto {
  /** nome do titular, como está no perfil */
  nome: string;
  /** o que já está no aplicativo, para achar o outro lado da transferência */
  existentes?: Transaction[];
}

export interface Resultado {
  linhas: Triada[];
  /** lançamentos que já estavam no app e viraram movimentação junto */
  virarMovimentacao: string[];
}

/* --------------------------- ferramentas --------------------------- */

/** Minúsculas, sem acento, sem espaço sobrando. */
export function normalizar(texto: string): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A impressão digital da linha: o que sobra depois de tirar tudo que muda
 * de um mês para o outro.
 *
 * "PIX ENVIADO 12/09 ID 8837261 - DIEGO SOARES" vira "pix enviado diego
 * soares". Sem isso, nenhuma regra aprendida casaria duas vezes, porque
 * data e identificador nunca se repetem.
 */
export function digital(texto: string): string {
  return normalizar(texto)
    .replace(/\d{2}[/-]\d{2}([/-]\d{2,4})?/g, " ")
    .replace(/\d{2}:\d{2}(:\d{2})?/g, " ")
    .replace(/\b\d[\d.,]*\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LIGACOES = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Os pedaços do nome que valem comparação. "Diego Soares" vira [diego, soares]. */
export function pedacosDoNome(nome: string): string[] {
  return normalizar(nome)
    .split(" ")
    .filter((p) => p.length >= 3 && !LIGACOES.has(p));
}

/* Palavras que o banco escreve em volta do nome. Elas não são nome de
   ninguém, e atrapalham a comparação se entrarem na conta. */
const RUIDO = new Set([
  "pix", "enviado", "enviada", "recebido", "recebida", "envio", "transferencia",
  "transf", "ted", "doc", "tev", "para", "pagamento", "pagto", "banco", "bco",
  "conta", "corrente", "poupanca", "compra", "cartao", "debito", "credito",
  "ltda", "me", "sa", "eireli", "mei", "id", "chave", "cpf", "cnpj", "agencia",
]);

/**
 * Os pedaços da linha que podem ser nome de alguém, sem repetição.
 *
 * A repetição importa: a triagem olha a descrição crua e a limpa juntas,
 * então o mesmo nome aparece duas vezes. Sem tirar a repetição, um único
 * sobrenome em comum contaria como dois e viraria "é você".
 */
function possiveisNomes(texto: string): string[] {
  const achados = digital(texto)
    .split(" ")
    .filter((p) => p.length >= 3 && !RUIDO.has(p) && !LIGACOES.has(p));
  return [...new Set(achados)];
}

/**
 * A linha cita o próprio titular?
 *
 * Dois pedaços do nome batendo é conclusivo, e é o caso real: o banco
 * escreve o nome completo, mais comprido do que o do perfil.
 *
 * Um pedaço só depende do que veio junto. "Maria Aparecida Soares" tem
 * "soares" em comum com o titular, mas traz dois nomes que não são dele:
 * é outra pessoa, e Pix para outra pessoa é gasto, mesmo que seja para a
 * mãe, mesmo que volte depois. Já uma linha em que o único nome presente
 * é um pedaço do titular fica em dúvida, e quem decide é a pessoa.
 */
export function citaOTitular(texto: string, pedacos: string[]): "sim" | "talvez" | "nao" {
  if (!pedacos.length) return "nao";
  const nomes = possiveisNomes(texto);
  if (!nomes.length) return "nao";

  const batem = nomes.filter((n) => pedacos.includes(n));
  if (!batem.length) return "nao";
  /** pedaços do titular que a linha não traz */
  const faltando = pedacos.filter((p) => !nomes.includes(p));
  /** nomes na linha que não são do titular */
  const estranhos = nomes.filter((n) => !pedacos.includes(n));

  /* O nome inteiro do titular está ali. O banco costuma escrever mais do
     que o perfil, então sobrar um nome a mais é o caso normal. */
  if (!faltando.length) return "sim";

  /* A linha é um pedaço do nome do titular e nada além disso. */
  if (batem.length >= 2 && !estranhos.length) return "sim";

  /* Dois nomes em comum, mas falta um do titular e sobra um estranho:
     "Maria Soares Vieira" para o Diego Soares Vieira. Sobrenome de
     família é comum demais no Brasil para decidir sozinho, e Pix para
     outra pessoa é gasto. Quem responde é a pessoa. */
  if (batem.length >= 2) return "talvez";

  /* Um nome só em comum: sem nada estranho ao redor ainda pode ser o
     titular abreviado; com nome estranho junto, é outra pessoa. */
  return estranhos.length ? "nao" : "talvez";
}

/* Vocabulário que os bancos usam para dinheiro guardado. Não é lista de
   marcas: é o que aparece escrito na linha do extrato. */
/* "reserva", "objetivo" e "fundo" ficaram de fora de propósito: são nome
   de loja e de escola no Brasil, e marcar a mensalidade do Colégio
   Objetivo como dinheiro guardado seria esconder um gasto real. Elas só
   contam acompanhadas, como em "fundo de investimento". */
const APLICACAO =
  /\b(aplicacao|aplicacoes|aplicado|resgate|resgatado|caixinha|caixinhas|cofrinho|porquinho|rendimento|rendimentos|cdb|rdb|lci|lca|lft|tesouro direto|tesouro selic|poupanca|previdencia|investimento|investimentos|renda fixa|fundo de investimento|reserva de emergencia)\b/;

/** A linha fala de dinheiro guardado, e não de consumo? */
export function pareceAplicacao(texto: string): boolean {
  return APLICACAO.test(normalizar(texto));
}

const DIA = 24 * 60 * 60 * 1000;

/** Distância em dias entre duas datas ISO, sempre positiva. */
function distancia(a: string, b: string): number {
  /* O "Z" é obrigatório: sem ele a data é lida no fuso local e uma
     mudança de horário de verão transformaria 24h em 25h, quebrando o par. */
  const x = Date.parse(a + "T12:00:00Z");
  const y = Date.parse(b + "T12:00:00Z");
  if (Number.isNaN(x) || Number.isNaN(y)) return Infinity;
  return Math.abs(x - y) / DIA;
}

/** Mesmo valor, sentidos opostos, no mesmo dia ou no seguinte. */
function ehEspelho(
  a: { amount: number; kind: Natureza; date: string },
  b: { amount: number; kind: Natureza; date: string }
): boolean {
  if (a.kind === b.kind) return false;
  if (a.kind === "movimentacao" || b.kind === "movimentacao") return false;
  /* Centavos batendo é o que faz o sinal valer. Tarifa de TED quebraria
     o par, e nesse caso a linha cai no teste de nome ou vira dúvida. */
  if (Math.abs(a.amount - b.amount) > 0.005) return false;
  return distancia(a.date, b.date) <= 1;
}

/* ---------------------------- a triagem ---------------------------- */

const MOTIVOS = {
  espelhoArquivo: "saiu de uma conta e entrou na outra, no mesmo valor",
  espelhoApp: "é o outro lado de um lançamento que já está aqui",
  nome: "o destinatário é você",
  aplicacao: "dinheiro guardado, não gasto",
  talvezNome: "pode ser transferência sua, o nome bate em parte",
};

/**
 * Classifica as linhas de um extrato.
 *
 * O que não tem sinal nenhum continua como veio: saída é gasto, entrada é
 * receita. Errar contando um gasto a mais incomoda; esconder um gasto de
 * quem está tentando se organizar quebra a confiança no aplicativo.
 */
export function triar(
  linhas: { row: Omit<Transaction, "id">; bruto: string }[],
  ctx: Contexto
): Resultado {
  const pedacos = pedacosDoNome(ctx.nome);
  const existentes = ctx.existentes ?? [];
  const virarMovimentacao: string[] = [];

  const saida: Triada[] = linhas.map(({ row, bruto }) => ({
    row,
    bruto,
    /* Guardado antes de qualquer classificação: depois que a linha vira
       movimentação, não dá mais para saber se ela saiu ou entrou, e é
       esse sentido que separa "Pix enviado para Fulano" de "Pix recebido
       de Fulano", que viram a mesma descrição depois da limpeza. */
    direcao: row.kind === "receita" ? ("e" as const) : ("s" as const),
    sugestao: {
      natureza: row.kind,
      motivo: "",
      certeza: "alta" as const,
    },
  }));

  const marcar = (i: number, motivo: string, certeza: Sugestao["certeza"] = "alta") => {
    saida[i].sugestao = {
      natureza: certeza === "alta" ? "movimentacao" : saida[i].row.kind,
      motivo,
      certeza,
    };
  };

  /* 1. Espelho dentro do próprio arquivo, ou entre os dois extratos que a
     pessoa importou de uma vez. */
  const usado = new Set<number>();
  for (let i = 0; i < saida.length; i++) {
    if (usado.has(i)) continue;
    for (let j = i + 1; j < saida.length; j++) {
      if (usado.has(j)) continue;
      if (!ehEspelho(saida[i].row, saida[j].row)) continue;
      usado.add(i);
      usado.add(j);
      saida[i].parNoArquivo = j;
      saida[j].parNoArquivo = i;
      marcar(i, MOTIVOS.espelhoArquivo);
      marcar(j, MOTIVOS.espelhoArquivo);
      break;
    }
  }

  /* 2. Espelho com o que já está no aplicativo: o caso de importar um
     banco hoje e o outro amanhã. Os dois lados viram movimentação, senão
     o mês fica certo de um lado e errado do outro. */
  for (let i = 0; i < saida.length; i++) {
    if (usado.has(i)) continue;
    const alvo = existentes.find(
      (t) => ehEspelho(saida[i].row, t) && !virarMovimentacao.includes(t.id)
    );
    if (!alvo) continue;
    usado.add(i);
    saida[i].parNoApp = alvo.id;
    virarMovimentacao.push(alvo.id);
    marcar(i, MOTIVOS.espelhoApp);
  }

  /* 3. Aplicação e resgate, nos dois sentidos. Rendimento entra aqui de
     propósito: ele nasce dentro do investimento e não é dinheiro que
     entrou para ser gasto no mês. */
  for (let i = 0; i < saida.length; i++) {
    if (usado.has(i)) continue;
    const texto = `${saida[i].bruto} ${saida[i].row.description}`;
    if (!pareceAplicacao(texto)) continue;
    usado.add(i);
    marcar(i, MOTIVOS.aplicacao);
  }

  /* 4. O nome do titular. Só para saída: dinheiro entrando com o seu nome
     é transferência que você mesmo mandou de outra conta, e o espelho já
     teria pegado; sem o espelho, é mais seguro tratar como receita. */
  for (let i = 0; i < saida.length; i++) {
    if (usado.has(i)) continue;
    if (saida[i].row.kind !== "despesa") continue;
    const texto = `${saida[i].bruto} ${saida[i].row.description}`;
    const veredito = citaOTitular(texto, pedacos);
    if (veredito === "sim") {
      usado.add(i);
      marcar(i, MOTIVOS.nome);
    } else if (veredito === "talvez") {
      usado.add(i);
      marcar(i, MOTIVOS.talvezNome, "duvida");
    }
  }

  return { linhas: saida, virarMovimentacao };
}

/** Quantas linhas ainda esperam uma decisão da pessoa. */
export function emDuvida(linhas: Triada[]): number {
  return linhas.filter((l) => l.sugestao.certeza === "duvida").length;
}
