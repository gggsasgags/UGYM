import { useEffect, useState } from "react";

/* ------------------------------------------------------------------
   Foto de perfil na tela.

   Desde que a imagem saiu da tabela e foi para o Storage, o endereço é
   uma URL assinada que expira. Um aplicativo aberto o dia inteiro pode
   chegar nesse prazo, e o arquivo também pode ter sido apagado por
   fora. Nesses casos o <img> sozinho mostraria o ícone de imagem
   quebrada, que é pior do que não ter foto.

   Aqui a falha de carregamento cai na inicial do nome, exatamente como
   acontece com quem nunca escolheu foto nenhuma.
-------------------------------------------------------------------*/

export function Foto({
  src,
  letra,
  className,
  classNameLetra,
}: {
  src?: string;
  letra: string;
  className?: string;
  classNameLetra?: string;
}) {
  const [quebrou, setQuebrou] = useState(false);

  /* Endereço novo merece uma chance nova: trocar de foto ou reassinar a
     URL precisa apagar a lembrança do erro anterior. */
  useEffect(() => setQuebrou(false), [src]);

  if (!src || quebrou) {
    return <span className={classNameLetra ?? className}>{letra}</span>;
  }

  return (
    <img className={className} src={src} alt="" onError={() => setQuebrou(true)} />
  );
}
