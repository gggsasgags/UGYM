

/* ------------------------------------------------------------------
   Parcelar e repetir são coisas diferentes.

   O Diego apontou isso em 13/10/2026, e ele está certo. Até aqui o app
   chamava de "Parcelado" uma coisa que na verdade REPETIA: você digitava
   R$ 500 e escolhia 10 vezes, e nasciam dez lançamentos de R$ 500. Quem
   parcelou uma compra de R$ 500 em dez esperava dez de R$ 50.

   Agora a pergunta é feita por escrito, e são duas:

     1. até quando isso vai  · em vez de "quantas vezes", a pessoa
        escolhe o mês da última parcela, que é como ela pensa quando
        olha a fatura do cartão;

     2. o valor que você digitou é o total ou é cada parcela · a
        resposta decide se o app divide ou repete, e a frase embaixo do
        campo sempre mostra a conta pronta, para ninguém precisar
        adivinhar.
-------------------------------------------------------------------*/

/** Quantos meses de um ym para outro. Negativo se o segundo vier antes. */
export const mesesEntre = (de: string, ate: string) => {
  const [dy, dm] = de.split("-").map(Number);
  const [ay, am] = ate.split("-").map(Number);
  return (ay - dy) * 12 + (am - dm);
};

/**
 * Quantas parcelas cabem entre o mês do lançamento e o mês escolhido
 * como último. Nunca menos de 2: uma parcela só não é parcelamento, e o
 * formulário já trata esse caso trocando a repetição para "só este mês".
 */
export const parcelasAte = (dataISO: string, ultimoYM: string) =>
  Math.max(2, Math.min(120, mesesEntre(dataISO.slice(0, 7), ultimoYM) + 1));

/* ------------------------------------------------------------------
   A parcela escrita na descrição.

   Segunda coisa que o Diego pegou: ele lançou "revisão do carro 5 de 6",
   pediu parcelamento, e a linha virou "revisão do carro 5 de 6 1/2",
   porque o app numera por cima do que a pessoa escreveu.

   O jeito certo é ler o que ela escreveu. Quem digita "5 de 6" está
   dizendo as duas coisas de uma vez: que isso é um parcelamento e que
   ele já está na quinta de seis. O app agora entende, tira o número da
   descrição e continua a contagem de onde ela parou.

   Os formatos aceitos são os que as pessoas escrevem de verdade:
   "5 de 6", "5/6", "5 - 6", "(5/6)", "05 de 06", com ou sem a palavra
   "parcela" na frente.
-------------------------------------------------------------------*/

const MARCA =
  /[\s·,\-–(\[]*(?:parcela\s*)?(\d{1,3})\s*(?:\/|de|-|–)\s*(\d{1,3})\s*[)\]]*\s*$/i;

export interface ParcelaLida {
  /** a descrição sem o número, já aparada */
  limpa: string;
  /** em qual parcela a pessoa está */
  atual: number;
  /** de quantas */
  total: number;
}

/**
 * Lê "revisão do carro 5 de 6" e devolve { limpa: "revisão do carro",
 * atual: 5, total: 6 }. Devolve null quando não há marca nenhuma, ou
 * quando os números não fazem sentido como parcela.
 */
export function lerParcelaNaDescricao(descricao: string): ParcelaLida | null {
  const m = MARCA.exec(descricao);
  if (!m) return null;

  const atual = Number(m[1]);
  const total = Number(m[2]);
  /* "2 de 10" é parcela. "1 de 1" não é, e "7 de 3" é engano de quem
     digitou. Na dúvida o app não mexe em nada. */
  if (!atual || !total || total < 2 || atual > total) return null;

  const limpa = descricao.slice(0, m.index).trim().replace(/[\s·,\-–]+$/, "");
  /* Se tirar o número não sobra descrição, então aquilo não era marca de
     parcela, era o nome inteiro do lançamento. */
  if (!limpa) return null;

  return { limpa, atual, total };
}

/**
 * A descrição já traz a própria numeração? Usado pelas telas para não
 * escreverem "5 de 6" de novo do lado de "5 de 6".
 */
export const temMarcaDeParcela = (descricao: string) => MARCA.test(descricao);
