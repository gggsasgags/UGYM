/* ------------------------------------------------------------------
   Como deixar o Gastô na tela do celular.

   Muita gente usa o site pelo navegador sem saber que dá para instalar
   como aplicativo, com ícone próprio e sem barra de endereço. O texto
   mora aqui, num arquivo só, porque aparece em dois lugares: no site,
   para quem ainda não tem conta, e dentro do menu do aplicativo, para
   quem já entrou.

   As palavras entre aspas são as que aparecem no aparelho, exatamente
   como estão lá. Um passo a passo com palavra aproximada não ajuda
   ninguém a achar o botão.
-------------------------------------------------------------------*/

export const PASSOS_INSTALAR = {
  iphone: [
    "Abra o Gastô no Safari. No iPhone, só por ele.",
    "Toque no botão de compartilhar, o quadrado com a seta para cima, na barra de baixo.",
    "Role a lista e toque em “Adicionar à Tela de Início”.",
    "Toque em “Adicionar”, no canto de cima. O ícone verde aparece junto dos outros.",
  ],
  android: [
    "Abra o Gastô no Chrome.",
    "Toque nos três pontinhos, no canto de cima.",
    "Toque em “Instalar aplicativo” ou “Adicionar à tela inicial”.",
    "Confirme em “Instalar”. O ícone verde aparece junto dos outros.",
  ],
} as const;

export type Aparelho = keyof typeof PASSOS_INSTALAR;

/** chute inicial pelo aparelho de quem está lendo, para poupar um toque */
export const aparelhoProvavel = (): Aparelho =>
  typeof navigator !== "undefined" && /android/i.test(navigator.userAgent) ? "android" : "iphone";
