import { useMemo, useState } from "react";
import { Icon } from "./Icon";
import { buscarEmojis } from "../lib/categories";

/* ------------------------------------------------------------------
   Escolher o emoji da categoria.

   São mais de cem, o que é muito para jogar tudo de uma vez na cara de
   quem só quer criar "Pet". Então vêm em grupos, na ordem em que as
   pessoas procuram, e existe uma busca por palavra: "cachorro" acha o
   🐶 sem rolar nada. Sem busca, a lista abre já rolável, com altura
   limitada para não empurrar o botão de salvar para fora da tela.

   O QUE MUDOU EM 13/10/2026, e por quê.

   O Diego viu a namorada dele criando uma categoria e errando duas
   vezes, do mesmo jeito nas duas: ela tocou num emoji, achou que tinha
   escolhido, criou a categoria e só depois percebeu que tinha saído com
   outro. Três coisas causavam isso, e as três mudaram aqui.

     1. o alvo era pequeno · 34px de lado, abaixo do tamanho de um
        toque confortável. Agora são 40, e o dedo acerta.

     2. a resposta era fraca · o emoji escolhido ganhava uma borda
        discreta no meio de uma grade de cem. Agora ele fica verde,
        cresce e sobra no meio da grade.

     3. não existia prévia, existia um campo · a caixinha com o emoji
        em cima parecia lugar de digitar, e ninguém entendeu que era o
        resultado. Agora tem uma bolha grande e escrito "assim vai
        ficar", com o nome do lado, e ela pisca a cada troca. É onde o
        olho já está quando o dedo toca.
-------------------------------------------------------------------*/

export function EmojiPicker({
  value,
  onPick,
  nome,
}: {
  value: string;
  onPick: (emoji: string) => void;
  /** o nome que a pessoa está digitando, para a prévia mostrar o conjunto */
  nome?: string;
}) {
  const [q, setQ] = useState("");
  const grupos = useMemo(() => buscarEmojis(q), [q]);

  return (
    <div className="emojipick">
      {/* A `key` no emoji não é enfeite: ela remonta o elemento a cada
          troca, e é isso que faz a animação rodar de novo. Sem ela, quem
          toca em dois emojis seguidos não vê o segundo responder. */}
      <div className="emojipick__atual">
        <span className="emojipick__bolha" key={value}>
          {value || "🏷️"}
        </span>
        <span className="emojipick__legenda">
          <b>Assim vai ficar na lista</b>
          <span>
            {value || "🏷️"} {nome?.trim() || "nome da categoria"}
          </span>
        </span>
      </div>

      <label className="emojipick__busca">
        <Icon name="search" size={14} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar emoji: pet, aluguel, viagem…"
          aria-label="Buscar emoji"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Limpar busca">
            <Icon name="close" size={13} />
          </button>
        )}
      </label>

      <div className="emojipick__rol">
        {grupos.map((g) => (
          <div className="emojipick__g" key={g.nome}>
            <span className="emojipick__h mono">{g.nome}</span>
            <div className="emojis">
              {g.itens.map(([emoji, palavras]) => (
                <button
                  type="button"
                  key={emoji}
                  className="emojis__i"
                  aria-pressed={value === emoji}
                  aria-label={palavras.split(" ")[0]}
                  title={palavras.split(" ").slice(0, 3).join(", ")}
                  onClick={() => onPick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}

        {grupos.length === 0 && (
          <p className="dim" style={{ padding: "8px 2px" }}>
            Nenhum emoji com esse nome. Você também pode digitar um direto no campo ao lado do
            nome da categoria.
          </p>
        )}
      </div>
    </div>
  );
}
