import type { Kind } from "./types";
import { digital } from "./triagem";
import type { Triada } from "./triagem";

/* ------------------------------------------------------------------
   As regras que a pessoa ensina.

   A detecção automática acerta o que é formulaico. O resto, só quem vive
   aquela conta sabe: que "Pix para Fulano" é a diarista, que "Tarifa
   pacote" é gasto fixo, que aquela transferência sem nome é a caixinha.

   Ninguém preenche formulário de regra antes de usar. Mas todo mundo
   corrige uma linha errada quando ela está na cara. Então a regra nasce
   da correção: o que a pessoa decide na conferência do extrato, e o que
   ela conserta depois num lançamento, o Gastô passa a lembrar.

   No primeiro mês são dez correções. No segundo, duas. No terceiro,
   nenhuma. O trabalho vai a zero por acúmulo, e não por adivinhação.

   A chave é a impressão digital da linha, e não o texto cru: data,
   horário e identificador mudam todo mês e fariam a regra nunca casar
   duas vezes.
-------------------------------------------------------------------*/

export interface Regra {
  /** a impressão digital da descrição, que é o que se repete */
  chave: string;
  /** o que fazer com o tipo, quando a pessoa ensinou isso */
  kind?: Kind;
  /** a categoria que ela escolheu, quando ensinou isso */
  categoria?: string;
  /** só para a tela: o texto que originou a regra */
  exemplo: string;
  atualizada: string;
}

/* Descrições que o próprio limpador inventa quando o banco não diz nada.
   Elas se repetem em extrato de qualquer pessoa e de qualquer banco, e
   uma regra presa a elas pegaria meio mundo. */
const GENERICAS = new Set([
  "lancamento importado",
  "pix enviado",
  "pix recebido",
  "fatura do cartao",
  "transferencia",
]);

/**
 * A chave que identifica uma linha de extrato que se repete todo mês.
 *
 * Vem da descrição já limpa, e não da crua, porque é a limpa que fica
 * guardada no lançamento: sem isso, a regra nascida na conferência nunca
 * casaria com a nascida de uma edição feita depois dentro do aplicativo.
 *
 * O sentido entra na chave porque a limpeza apaga "enviado" e "recebido".
 * Sem ele, "Pix enviado para Fulano" e "Pix recebido de Fulano" viram a
 * mesma coisa, e uma regra aprendida na saída passaria a valer para a
 * devolução do dinheiro no mês seguinte.
 */
export function chaveDaLinha(descricao: string, direcao: "e" | "s"): string {
  const d = digital(descricao).slice(0, 180);
  /* Curta demais casa com meio extrato; genérica demais casa com todo
     mundo. Nos dois casos, é melhor não aprender nada. */
  if (d.length < 4 || GENERICAS.has(d)) return "";
  return `${d}|${direcao}`;
}

/** Índice por chave, com a regra mais recente ganhando. */
export function indexar(regras: Regra[]): Map<string, Regra> {
  const mapa = new Map<string, Regra>();
  for (const r of regras) {
    if (!r.chave) continue;
    const atual = mapa.get(r.chave);
    if (!atual || atual.atualizada <= r.atualizada) mapa.set(r.chave, r);
  }
  return mapa;
}

/**
 * Aplica o que a pessoa já ensinou por cima do que o app deduziu.
 *
 * A regra sempre ganha da detecção automática, inclusive quando a
 * detecção tinha certeza: quem mora naquela conta sabe mais do que
 * qualquer heurística. E regra também desfaz dúvida, que é o efeito que
 * a pessoa sente de verdade: a linha que ela decidiu mês passado não
 * pergunta de novo.
 */
export function aplicarRegras(
  linhas: Triada[],
  regras: Regra[],
  categorias: { id: string; kind: Kind }[] = []
): Triada[] {
  const mapa = indexar(regras);
  if (!mapa.size) return linhas;
  const porId = new Map(categorias.map((c) => [c.id, c]));

  return linhas.map((l) => {
    const chave = chaveDaLinha(l.row.description, l.direcao);
    const regra = chave ? mapa.get(chave) : undefined;
    if (!regra) return l;

    /* O espelho é aritmética, não palpite: saiu 400 de um lado e entrou
       400 do outro. Memória antiga não desfaz isso, senão um lado da
       transferência vira gasto e o outro fica de fora, que é pior do que
       os dois errados juntos. */
    const temPar = l.parNoArquivo !== undefined || l.parNoApp !== undefined;
    const kind = temPar ? undefined : regra.kind;

    const row = { ...l.row };
    const natureza = kind ?? l.sugestao.natureza;
    if (kind) row.kind = kind;

    /* Categoria apagada pelo usuário não pode voltar pela porta dos
       fundos, e categoria de despesa não serve para receita. */
    const cat = regra.categoria ? porId.get(regra.categoria) : undefined;
    if (cat && (natureza === "movimentacao" || cat.kind === natureza)) {
      row.category = cat.id;
    }

    return {
      ...l,
      row,
      sugestao: {
        natureza,
        /* Só apaga a dúvida quem ensinou o tipo. Regra de categoria não
           responde "isto é transferência sua?". */
        motivo: kind ? "você já ensinou isso ao Gastô" : l.sugestao.motivo,
        certeza: kind ? "alta" : l.sugestao.certeza,
      },
    };
  });
}

/**
 * O que a pessoa acabou de ensinar nesta conferência.
 *
 * Só vira regra o que ela mudou de fato. Concordar com o palpite do app
 * não ensina nada, e encher a lista de regras que repetem a dedução
 * automática só atrapalharia o dia em que a dedução melhorar.
 */
export function aprenderDaConferencia(
  linhas: Triada[],
  decidido: Record<number, Kind>,
  hoje: string
): Regra[] {
  const novas: Regra[] = [];
  for (const [indice, kind] of Object.entries(decidido)) {
    const l = linhas[Number(indice)];
    if (!l) continue;
    /* Confirmar o que o app já dizia não é ensinamento. */
    if (kind === l.sugestao.natureza && l.sugestao.certeza === "alta") continue;
    const chave = chaveDaLinha(l.row.description, l.direcao);
    if (!chave) continue;
    novas.push({
      chave,
      kind,
      exemplo: l.row.description,
      atualizada: hoje,
    });
  }
  return novas;
}

/**
 * O que a pessoa ensinou ao consertar um lançamento já importado.
 *
 * É daqui que sai a memória de categoria: o Pix para a farmácia que se
 * chama "Juninho Pernambucano" nenhum extrato do mundo entrega
 * categorizado, mas basta a pessoa dizer uma vez.
 */
export function aprenderDaEdicao(
  antes: { description: string; kind: Kind; category: string },
  depois: { description?: string; kind?: Kind; category?: string },
  hoje: string
): Regra | null {
  const mudouKind = depois.kind !== undefined && depois.kind !== antes.kind;
  /* Trocar o tipo troca a lista de categorias na tela, e o formulário
     escolhe a primeira sozinho. Aprender essa categoria seria aprender
     uma escolha que a pessoa não fez. */
  const mudouCategoria =
    !mudouKind && depois.category !== undefined && depois.category !== antes.category;
  if (!mudouKind && !mudouCategoria) return null;

  /* A descrição usada é a de antes: é ela que vai aparecer de novo no
     extrato do mês que vem, e não o texto que a pessoa reescreveu. */
  const chave = chaveDaLinha(antes.description, antes.kind === "receita" ? "e" : "s");
  if (!chave) return null;

  return {
    chave,
    kind: mudouKind ? depois.kind : undefined,
    categoria: mudouCategoria ? depois.category : undefined,
    exemplo: antes.description,
    atualizada: hoje,
  };
}

/** Junta o que já existia com o que acabou de ser ensinado. */
export function fundir(atuais: Regra[], novas: Regra[]): Regra[] {
  const mapa = new Map(atuais.filter((r) => r.chave).map((r) => [r.chave, r]));
  for (const nova of novas) {
    if (!nova.chave) continue;
    const velha = mapa.get(nova.chave);
    /* Ensinar categoria não apaga o tipo ensinado antes, e vice-versa. */
    mapa.set(nova.chave, {
      chave: nova.chave,
      kind: nova.kind ?? velha?.kind,
      categoria: nova.categoria ?? velha?.categoria,
      exemplo: nova.exemplo || velha?.exemplo || "",
      atualizada: nova.atualizada,
    });
  }
  return [...mapa.values()];
}
