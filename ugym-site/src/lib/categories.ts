import type { Category } from "./types";

export const BASE_CATEGORIES: Category[] = [
  { id: "mercado", label: "Mercado", emoji: "🛒", kind: "despesa", base: true },
  { id: "restaurante", label: "Restaurante", emoji: "🍽️", kind: "despesa", base: true },
  { id: "combustivel", label: "Combustível", emoji: "⛽", kind: "despesa", base: true },
  { id: "carro", label: "Carro", emoji: "🚗", kind: "despesa", base: true },
  { id: "casa", label: "Casa", emoji: "🏠", kind: "despesa", base: true },
  { id: "saude", label: "Saúde", emoji: "💊", kind: "despesa", base: true },
  { id: "academia", label: "Academia", emoji: "🏋️", kind: "despesa", base: true },
  { id: "entretenimento", label: "Entretenimento", emoji: "🎬", kind: "despesa", base: true },
  { id: "viagem", label: "Viagem", emoji: "✈️", kind: "despesa", base: true },
  { id: "vestuario", label: "Vestuário", emoji: "👕", kind: "despesa", base: true },
  { id: "educacao", label: "Educação", emoji: "📚", kind: "despesa", base: true },
  { id: "assinaturas", label: "Assinaturas", emoji: "🔁", kind: "despesa", base: true },
  { id: "pessoal", label: "Pessoal", emoji: "💈", kind: "despesa", base: true },
  { id: "transporte", label: "Transporte", emoji: "🚌", kind: "despesa", base: true },
  { id: "compras", label: "Compras", emoji: "🛍️", kind: "despesa", base: true },
  { id: "cartao", label: "Cartão de crédito", emoji: "💳", kind: "despesa", base: true },
  { id: "outros", label: "Outros", emoji: "📦", kind: "despesa", base: true },
  { id: "salario", label: "Salário", emoji: "💰", kind: "receita", base: true },
  { id: "freelance", label: "Freelance", emoji: "💼", kind: "receita", base: true },
  { id: "investimentos", label: "Investimentos", emoji: "📈", kind: "receita", base: true },
];

/* ------------------------------------------------------------------
   Emojis para categoria.

   Vêm em grupos, na ordem em que as pessoas procuram, e cada um carrega
   as palavras pelas quais costuma ser chamado em português. A busca usa
   essas palavras: quem digita "cachorro" acha 🐶 sem precisar rolar a
   lista inteira.
-------------------------------------------------------------------*/

export interface GrupoEmoji {
  nome: string;
  itens: [emoji: string, palavras: string][];
}

export const EMOJI_GROUPS: GrupoEmoji[] = [
  {
    nome: "Comida",
    itens: [
      ["🛒", "mercado supermercado compras carrinho"],
      ["🍽️", "restaurante comida almoço jantar prato"],
      ["🍔", "lanche hamburguer fast food"],
      ["🍕", "pizza pizzaria"],
      ["🍣", "sushi japonês comida"],
      ["🥗", "salada saudável comida"],
      ["🍎", "fruta feira hortifruti maçã"],
      ["🥖", "padaria pão"],
      ["☕", "café cafeteria cafezinho"],
      ["🧋", "bebida suco chá boba"],
      ["🍺", "cerveja bar chopp bebida"],
      ["🍷", "vinho bar bebida"],
      ["🍦", "sorvete sobremesa doce"],
      ["🍫", "chocolate doce guloseima"],
      ["🥩", "carne açougue churrasco"],
      ["🍱", "marmita comida delivery"],
    ],
  },
  {
    nome: "Transporte",
    itens: [
      ["⛽", "combustível gasolina posto etanol"],
      ["🚗", "carro automóvel veículo"],
      ["🚕", "táxi uber corrida aplicativo"],
      ["🚌", "ônibus transporte público"],
      ["🚇", "metrô trem transporte"],
      ["🛵", "moto entrega delivery scooter"],
      ["🚲", "bicicleta bike pedal"],
      ["✈️", "avião viagem passagem voo"],
      ["🛳️", "navio cruzeiro viagem barco"],
      ["🅿️", "estacionamento parquímetro vaga"],
      ["🛠️", "oficina mecânico manutenção conserto"],
      ["🛣️", "pedágio estrada viagem rodovia"],
    ],
  },
  {
    nome: "Casa",
    itens: [
      ["🏠", "casa moradia aluguel lar"],
      ["🔑", "aluguel chave imóvel"],
      ["💡", "luz energia conta elétrica"],
      ["🚿", "água chuveiro conta saneamento"],
      ["🔥", "gás botijão conta"],
      ["📶", "internet wifi banda larga"],
      ["📱", "celular telefone plano linha"],
      ["🧹", "limpeza faxina diarista"],
      ["🧺", "lavanderia roupa"],
      ["🪑", "móveis casa decoração"],
      ["🔧", "reforma conserto obra"],
      ["🪴", "planta jardim casa"],
    ],
  },
  {
    nome: "Saúde e cuidados",
    itens: [
      ["💊", "farmácia remédio medicamento"],
      ["🏥", "hospital consulta médico plano"],
      ["🦷", "dentista odontologia"],
      ["👓", "óculos ótica vista"],
      ["🧠", "terapia psicólogo saúde mental"],
      ["🏋️", "academia musculação treino"],
      ["🧘", "yoga pilates alongamento"],
      ["🏃", "corrida esporte treino"],
      ["⚽", "futebol esporte jogo"],
      ["💈", "barbeiro cabelo corte"],
      ["💅", "manicure unha salão"],
      ["🧴", "cosmético beleza pele perfume"],
    ],
  },
  {
    nome: "Lazer",
    itens: [
      ["🎬", "cinema filme entretenimento"],
      ["🎮", "jogo videogame games"],
      ["🎧", "música streaming spotify fone"],
      ["🎤", "show ingresso música festa"],
      ["🎭", "teatro cultura espetáculo"],
      ["🎟️", "ingresso evento"],
      ["🏖️", "praia férias viagem lazer"],
      ["🏨", "hotel hospedagem viagem"],
      ["📷", "foto câmera hobby"],
      ["🎨", "arte hobby pintura"],
      ["🎲", "jogo hobby tabuleiro"],
      ["🛝", "parque criança lazer"],
    ],
  },
  {
    nome: "Compras",
    itens: [
      ["🛍️", "compras loja shopping"],
      ["👕", "roupa vestuário camiseta"],
      ["👟", "tênis calçado sapato"],
      ["👜", "bolsa acessório"],
      ["⌚", "relógio acessório"],
      ["💻", "computador notebook eletrônico"],
      ["📺", "televisão eletrônico"],
      ["🎁", "presente aniversário"],
      ["📦", "entrega encomenda outros"],
      ["🧸", "brinquedo criança"],
      ["📚", "livro leitura livraria"],
      ["✏️", "material escolar papelaria"],
    ],
  },
  {
    nome: "Estudo e trabalho",
    itens: [
      ["🎓", "faculdade curso mensalidade educação"],
      ["🏫", "escola colégio"],
      ["🖥️", "trabalho escritório home office"],
      ["💼", "trabalho freelance serviço"],
      ["🧾", "imposto conta boleto nota"],
      ["🖨️", "impressão papelaria escritório"],
      ["🌐", "assinatura site domínio"],
      ["🔁", "assinatura recorrente mensalidade"],
    ],
  },
  {
    nome: "Dinheiro",
    itens: [
      ["💰", "salário dinheiro renda"],
      ["💵", "dinheiro espécie"],
      ["🏦", "banco tarifa conta"],
      ["💳", "cartão crédito fatura"],
      ["📈", "investimento rendimento ações"],
      ["🐷", "poupança reserva economia"],
      ["🎯", "meta objetivo"],
      ["🤝", "empréstimo dívida acordo"],
      ["❤️", "doação caridade ajuda"],
      ["⚖️", "advogado jurídico cartório"],
      ["🔒", "seguro proteção"],
      ["🏷️", "outros geral etiqueta"],
    ],
  },
  {
    nome: "Família e bichos",
    itens: [
      ["👶", "bebê criança filho"],
      ["🧒", "criança filho escola"],
      ["👨‍👩‍👧", "família casa"],
      ["🐶", "cachorro pet veterinário"],
      ["🐱", "gato pet veterinário"],
      ["🐾", "pet animal veterinário ração"],
      ["💍", "casamento noivado"],
      ["🎉", "festa aniversário comemoração"],
      ["🎂", "aniversário bolo festa"],
      ["🕯️", "religião igreja doação"],
    ],
  },
];

/** lista plana, na ordem dos grupos, para quem só quer escolher rápido */
export const EMOJI_SUGGESTIONS = EMOJI_GROUPS.flatMap((g) => g.itens.map(([e]) => e));

/** filtra por nome do emoji ou do grupo; sem busca, devolve tudo */
export function buscarEmojis(termo: string): GrupoEmoji[] {
  const q = termo
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (!q) return EMOJI_GROUPS;
  const limpo = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return EMOJI_GROUPS.map((g) => ({
    nome: g.nome,
    itens: g.itens.filter(
      ([emoji, palavras]) => emoji === termo.trim() || limpo(palavras).includes(q) || limpo(g.nome).includes(q)
    ),
  })).filter((g) => g.itens.length);
}

export const findCategory = (list: Category[], id: string): Category =>
  list.find((c) => c.id === id) ??
  list.find((c) => c.id === "outros") ?? {
    id: "outros",
    label: "Outros",
    emoji: "📦",
    kind: "despesa",
    base: true,
  };

/**
 * Transforma um nome em id.
 *
 * O corte de tamanho vem antes da limpeza das pontas de propósito:
 * cortar depois podia deixar um hífen sobrando no fim, e aí passar o
 * mesmo texto duas vezes por aqui dava dois ids diferentes. Isso já
 * criou lançamento apontando para categoria que não existia.
 */
export const slugify = (label: string) =>
  label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 28)
    .replace(/^-+|-+$/g, "") || `cat-${Date.now().toString(36)}`;

/* ------------------------------------------------------------------
   Palpite de categoria a partir da descrição do extrato do banco.
   A ordem importa: a primeira palavra encontrada decide.
-------------------------------------------------------------------*/
const HINTS: [RegExp, string][] = [
  [/\b(ifood|99\s?food|rappi|restaurante|lanchonete|pizzar|burger|gourmet|churrasc|padaria|cafe|coffee|sushi|acai|açaí|bar\b)/i, "restaurante"],
  [/\b(supermerc|mercado\s|atacad|carrefour|assai|assaí|big\b|extra\b|hortifr|sacol|mambo|pao de acucar|pão de açúcar)/i, "mercado"],
  [/\b(posto|combustiv|combustív|shell|ipiranga|petrobr|ale\b|gasolina|etanol|alcool|álcool)/i, "combustivel"],
  [/\b(uber|99\s?tecnolog|99app|cabify|taxi|táxi|metro|metrô|onibus|ônibus|bilhete|passagem urbana|estacion)/i, "transporte"],
  [/\b(oficina|mecanic|mecânic|pneu|seguro auto|detran|ipva|licenciam|lavagem|lava\s?jato)/i, "carro"],
  [/\b(farmac|farmác|drogaria|droga\s?raia|pacheco|laborator|clinic|clínic|hospital|dentist|psicolog|vitamina)/i, "saude"],
  [/\b(academia|smartfit|smart fit|bluefit|crossfit|pilates|personal)/i, "academia"],
  [/\b(cinema|ingresso|show|teatro|entretenim|游|steam|playstation|xbox|nintendo|bar e )/i, "entretenimento"],
  [/\b(netflix|spotify|amazon prime|disney|hbo|max\b|youtube premium|icloud|google one|assinatura)/i, "assinaturas"],
  [/\b(amazon|shopee|mercado livre|magalu|magazine luiza|americanas|aliexpress|shopping|loja|store|renner|riachuelo|c&a|zara|nike|adidas)/i, "compras"],
  [/\b(cw confec|confec|vestuario|vestuário|calcad|calçad|sapat)/i, "vestuario"],
  [/\b(aluguel|condomin|condomín|energia|enel|neoenergia|cemig|light\b|agua|água|caesb|sabesp|internet|vivo|claro|tim\b|oi\b|net\b|gas\b|iptu)/i, "casa"],
  [/\b(escola|faculdade|curso|udemy|alura|livraria|livro|material escolar|mensalidade)/i, "educacao"],
  [/\b(barbear|cabelei|salao|salão|manicure|estetic|estétic|perfum)/i, "pessoal"],
  [/\b(hotel|pousada|airbnb|passagem aerea|passagem aérea|latam|gol\b|azul\b|booking|decolar)/i, "viagem"],
  [/\b(pagamento cartao|pagamento cartão|fatura|cartao de credito|cartão de crédito)/i, "cartao"],
];

const INCOME_HINTS: [RegExp, string][] = [
  [/\b(salario|salário|pagamento de salario|folha|proventos|vencimento)/i, "salario"],
  [/\b(remuneracao|remuneração|rendimento|aplicacao|aplicação|resgate|dividend|juros|cdb|tesouro|poupanca|poupança)/i, "investimentos"],
  [/\b(freela|freelance|servico prestado|serviço prestado|honorar|honorár|nota fiscal)/i, "freelance"],
];

export function guessCategory(description: string, kind: "despesa" | "receita") {
  const list = kind === "receita" ? INCOME_HINTS : HINTS;
  for (const [re, id] of list) if (re.test(description)) return id;
  return kind === "receita" ? "salario" : "outros";
}
