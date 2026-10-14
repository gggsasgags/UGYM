import { BASE_CATEGORIES } from "./categories";
import { DEFAULT_HOME } from "./home";
import { uid } from "./series";
import type { Category, Ledger, Series, Transaction } from "./types";
import type { Regra } from "./regras";

/* ------------------------------------------------------------------
   O banco da vitrine.

   Este arquivo é o sósia do db.ts. Ele tem exatamente as mesmas funções,
   com os mesmos nomes e os mesmos argumentos, e nenhuma delas fala com
   rede: tudo acontece na memória e no armazenamento local do navegador.

   Para que serve: o artefato do Gastô roda numa caixa que bloqueia
   conexão para fora, então lá o app nunca alcançaria o Supabase. Com a
   troca feita na hora de construir (veja o vite.config.ts, modo
   "vitrine"), as telas continuam sendo as telas de verdade, o store
   continua sendo o store de verdade, e só o fundo do poço vira mentira.

   Duas regras para quem mexer aqui:

   1. A assinatura manda. Se o db.ts ganhar uma função, esta aqui ganha
      junto, senão a vitrine quebra numa tela que o site real usa bem.
   2. Isto NUNCA entra na construção normal. O plugin só troca os módulos
      quando o modo é "vitrine", e o site publicado continua falando com o
      Supabase como sempre falou.
-------------------------------------------------------------------*/

export interface Profile {
  name: string;
  avatar?: string;
  theme: "claro" | "escuro";
  calc: boolean;
  home: string[];
}

interface Tudo {
  profile: Profile;
  nasceu: boolean;
  tx: Transaction[];
  series: Series[];
  cats: Category[];
  skips: string[];
  regras: Regra[];
}

const CHAVE = "gasto-vitrine";

const zerado = (): Tudo => ({
  profile: { name: "", theme: "escuro", calc: false, home: DEFAULT_HOME },
  nasceu: false,
  tx: [],
  series: [],
  cats: [],
  skips: [],
  regras: [],
});

let memoria: Tudo | null = null;

function tudo(): Tudo {
  if (memoria) return memoria;
  try {
    const cru = localStorage.getItem(CHAVE);
    memoria = cru ? (JSON.parse(cru) as Tudo) : zerado();
  } catch {
    memoria = zerado();
  }
  return memoria;
}

function gravar(): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(tudo()));
  } catch {
    /* navegador sem armazenamento: a vitrine continua, só não lembra */
  }
}

/** Usada pela conta de mentira quando alguém aperta "apagar a minha conta". */
export function limparVitrine(): void {
  memoria = zerado();
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada a fazer */
  }
}

/* ---------------------------- perfil ---------------------------- */

export async function ensureProfile(_userId: string, name: string): Promise<Profile> {
  const t = tudo();
  if (!t.nasceu) {
    t.nasceu = true;
    t.profile = { ...t.profile, name };
    /* Mesma semeadura do banco de verdade: as categorias prontas entram
       uma vez só, no nascimento da conta. */
    t.cats = BASE_CATEGORIES.map((c) => ({ ...c }));
    gravar();
  }
  if (!t.profile.name) {
    t.profile.name = name;
    gravar();
  }
  return { ...t.profile };
}

export async function saveProfile(_userId: string, patch: Partial<Profile>): Promise<void> {
  const t = tudo();
  const p = t.profile;
  if (patch.name !== undefined) p.name = patch.name;
  /* "in" e não "!== undefined", pelo mesmo motivo do db.ts: passar
     `avatar: undefined` é o pedido de apagar a foto. */
  if ("avatar" in patch) p.avatar = patch.avatar;
  if (patch.theme !== undefined) p.theme = patch.theme;
  if (patch.calc !== undefined) p.calc = patch.calc;
  if (patch.home !== undefined) p.home = patch.home;
  gravar();
}

/* ---------------------------- regras ---------------------------- */

export async function loadRules(): Promise<Regra[]> {
  return tudo().regras.map((r) => ({ ...r }));
}

export async function saveRules(_userId: string, regras: Regra[]): Promise<void> {
  if (!regras.length) return;
  const t = tudo();
  for (const nova of regras) {
    const i = t.regras.findIndex((r) => r.chave === nova.chave);
    if (i >= 0) t.regras[i] = { ...nova };
    else t.regras.push({ ...nova });
  }
  gravar();
}

/* ---------------------------- leitura ---------------------------- */

export async function loadLedger(
  userId: string,
  nome = ""
): Promise<{ ledger: Ledger; profile: Profile; regras: Regra[] }> {
  const profile = await ensureProfile(userId, nome);
  const t = tudo();
  return {
    profile,
    regras: t.regras.map((r) => ({ ...r })),
    ledger: {
      transactions: [...t.tx].sort((a, b) => b.date.localeCompare(a.date)),
      series: t.series.map((s) => ({ ...s })),
      categories: t.cats.map((c) => ({ ...c })),
      skips: [...t.skips],
      home: profile.home,
      theme: profile.theme,
      calc: profile.calc,
    },
  };
}

/* ---------------------------- escrita ---------------------------- */

export async function insertTransactions(_userId: string, rows: Transaction[]): Promise<void> {
  if (!rows.length) return;
  const t = tudo();
  const tem = new Set(t.tx.map((x) => x.id));
  for (const r of rows) if (!tem.has(r.id)) t.tx.push({ ...r });
  gravar();
}

export async function updateTransaction(id: string, patch: Partial<Transaction>): Promise<void> {
  const t = tudo();
  const alvo = t.tx.find((x) => x.id === id);
  if (!alvo) return;
  Object.assign(alvo, patch);
  gravar();
}

export async function deleteTransactions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const t = tudo();
  const fora = new Set(ids);
  t.tx = t.tx.filter((x) => !fora.has(x.id));
  gravar();
}

export async function insertSeries(_userId: string, s: Series): Promise<void> {
  const t = tudo();
  if (!t.series.some((x) => x.id === s.id)) t.series.push({ ...s });
  gravar();
}

export async function deleteSeries(seriesId: string): Promise<void> {
  const t = tudo();
  t.tx = t.tx.filter((x) => x.seriesId !== seriesId);
  t.skips = t.skips.filter((k) => !k.startsWith(`${seriesId}@`));
  t.series = t.series.filter((s) => s.id !== seriesId);
  gravar();
}

export async function reassignCategory(ids: string[], para: string): Promise<void> {
  const t = tudo();
  const alvo = new Set(ids);
  for (const x of t.tx) if (alvo.has(x.id)) x.category = para;
  gravar();
}

export async function updateSeriesCategory(seriesId: string, category: string): Promise<void> {
  const t = tudo();
  const s = t.series.find((x) => x.id === seriesId);
  if (s) s.template = { ...s.template, category };
  gravar();
}

export async function addSkips(_userId: string, keys: string[]): Promise<void> {
  if (!keys.length) return;
  const t = tudo();
  for (const k of keys) if (!t.skips.includes(k)) t.skips.push(k);
  gravar();
}

export async function saveCategory(_userId: string, cat: Category): Promise<void> {
  const t = tudo();
  const i = t.cats.findIndex((c) => c.id === cat.id);
  if (i >= 0) t.cats[i] = { ...cat };
  else t.cats.push({ ...cat });
  gravar();
}

export async function removeCategory(
  _userId: string,
  slug: string,
  fallback: string
): Promise<void> {
  const t = tudo();
  for (const x of t.tx) if (x.category === slug) x.category = fallback;
  for (const s of t.series) {
    if (s.template.category === slug) s.template = { ...s.template, category: fallback };
  }
  t.cats = t.cats.filter((c) => c.id !== slug);
  gravar();
}

export async function wipeLedger(_userId: string): Promise<void> {
  const t = tudo();
  t.tx = [];
  t.series = [];
  t.skips = [];
  gravar();
}

export async function seedLedger(userId: string, ledger: Ledger): Promise<void> {
  const t = tudo();
  if (ledger.series.length) {
    for (const s of ledger.series) if (!t.series.some((x) => x.id === s.id)) t.series.push({ ...s });
  }
  await insertTransactions(userId, ledger.transactions);
  const extras = ledger.categories.filter((c) => !BASE_CATEGORIES.some((b) => b.id === c.id));
  for (const c of extras) await saveCategory(userId, c);
  if (ledger.skips.length) await addSkips(userId, ledger.skips);
  gravar();
}

export const newId = uid;
