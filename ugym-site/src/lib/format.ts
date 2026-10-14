import type { Kind } from "./types";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const brlCompact = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export const money = (v: number) => brl.format(v);

/* ------------------------------------------------------------------
   O dinheiro digitado, do jeito que o teclado do banco faz.

   Guardamos só os dígitos, e eles entram pela direita: o "5" vira cinco
   centavos, o "50" vira cinquenta, o "500" vira cinco reais. Ninguém
   procura a vírgula, e apagar é só o caminho de volta pela mesma régua.

   Fica aqui, e não na tela, porque a mesma regra vale para qualquer campo
   de valor que apareça depois.
-------------------------------------------------------------------*/

/** Só os dígitos, sem zero à esquerda e com teto de 9 casas. */
export const digitos = (texto: string) =>
  texto.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 9);

/** Os dígitos guardados viram reais: "1234" é 12,34. */
export const centavosParaNumero = (d: string) => Number(d || "0") / 100;

/** E viram texto com a vírgula no lugar certo, sem o "R$" na frente. */
export const centavosParaTexto = (d: string) =>
  centavosParaNumero(d).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const moneyCompact = (v: number) => brlCompact.format(v);

export const signed = (v: number, kind: Kind) =>
  (kind === "movimentacao" ? "" : kind === "despesa" ? "-" : "+") + brl.format(Math.abs(v));

export const pct = (v: number, digits = 0) =>
  `${v.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export const monthLabel = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const name = MONTHS[m - 1];
  return `${name[0].toUpperCase()}${name.slice(1)} ${y}`;
};

export const monthShort = (ym: string) => {
  const [, m] = ym.split("-").map(Number);
  return MONTHS_SHORT[m - 1];
};

/** "12 set" */
export const dayLabel = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
};

export const weekdayOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};

export const ymOf = (iso: string) => iso.slice(0, 7);

/** mês corrente no formato yyyy-mm */
export const todayYM = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const shiftMonth = (ym: string, delta: number) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** lista de meses entre dois yyyy-mm, no máximo 24 */
export const monthsRange = (from: string, to: string) => {
  const [a, b] = from <= to ? [from, to] : [to, from];
  const out: string[] = [];
  let cur = a;
  while (cur <= b && out.length < 24) {
    out.push(cur);
    cur = shiftMonth(cur, 1);
  }
  return out.length ? out : [to];
};

export const lastMonths = (ym: string, n: number) =>
  Array.from({ length: n }, (_, i) => shiftMonth(ym, i - (n - 1)));

export const daysInMonth = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
