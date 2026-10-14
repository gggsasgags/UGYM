import { supabase } from "./supabase";
import { BASE_CATEGORIES } from "./categories";
import { DEFAULT_HOME } from "./home";
import { uid } from "./series";
import type { Category, Ledger, Series, Transaction } from "./types";
import type { Regra } from "./regras";

/* ------------------------------------------------------------------
   Acesso ao banco.

   Este é o único arquivo que conhece nomes de tabela e de coluna. O
   resto do aplicativo continua falando apenas nos tipos de `types.ts`,
   então uma mudança de schema para aqui e não vaza para as telas.

   Todas as tabelas têm RLS por usuário, então as consultas não filtram
   por `user_id` na leitura: o banco já devolve só o que é do dono da
   sessão. Na escrita o `user_id` vai junto porque as políticas de
   inserção conferem que ele bate com quem está autenticado.
-------------------------------------------------------------------*/

/* --------------------------- tradução --------------------------- */

interface TxRow {
  id: string;
  description: string;
  amount: number | string;
  kind: string;
  category: string;
  date: string;
  recurrence: string;
  installment_current: number | null;
  installment_total: number | null;
  series_id: string | null;
}

const toTx = (r: TxRow): Transaction => ({
  id: r.id,
  description: r.description,
  // numeric do Postgres pode chegar como texto; o app espera número
  amount: Number(r.amount),
  kind: r.kind as Transaction["kind"],
  category: r.category,
  date: String(r.date).slice(0, 10),
  recurrence: r.recurrence as Transaction["recurrence"],
  ...(r.installment_current != null && r.installment_total != null
    ? { installment: { current: r.installment_current, total: r.installment_total } }
    : {}),
  ...(r.series_id ? { seriesId: r.series_id } : {}),
});

const fromTx = (t: Transaction, userId: string) => ({
  id: t.id,
  user_id: userId,
  description: t.description,
  amount: t.amount,
  kind: t.kind,
  category: t.category,
  date: t.date,
  recurrence: t.recurrence,
  installment_current: t.installment?.current ?? null,
  installment_total: t.installment?.total ?? null,
  series_id: t.seriesId ?? null,
});

interface SeriesRow {
  id: string;
  kind: string;
  start_ym: string;
  total: number | null;
  ended_ym: string | null;
  tpl_description: string;
  tpl_amount: number | string;
  tpl_kind: string;
  tpl_category: string;
  tpl_recurrence: string;
  tpl_day: number;
}

const toSeries = (r: SeriesRow): Series => ({
  id: r.id,
  kind: r.kind as Series["kind"],
  startYM: r.start_ym,
  ...(r.total != null ? { total: r.total } : {}),
  ...(r.ended_ym ? { endedYM: r.ended_ym } : {}),
  template: {
    description: r.tpl_description,
    amount: Number(r.tpl_amount),
    kind: r.tpl_kind as Series["template"]["kind"],
    category: r.tpl_category,
    recurrence: r.tpl_recurrence as Series["template"]["recurrence"],
    day: r.tpl_day,
  },
});

const fromSeries = (s: Series, userId: string) => ({
  id: s.id,
  user_id: userId,
  kind: s.kind,
  start_ym: s.startYM,
  total: s.total ?? null,
  ended_ym: s.endedYM ?? null,
  tpl_description: s.template.description,
  tpl_amount: s.template.amount,
  tpl_kind: s.template.kind,
  tpl_category: s.template.category,
  tpl_recurrence: s.template.recurrence,
  tpl_day: s.template.day,
});

interface CatRow {
  id: string;
  slug: string;
  label: string;
  emoji: string;
  kind: string;
  is_base: boolean;
}

const toCat = (r: CatRow): Category => ({
  id: r.slug,
  label: r.label,
  emoji: r.emoji,
  kind: r.kind as Category["kind"],
  ...(r.is_base ? { base: true } : {}),
});

const fromCat = (c: Category, userId: string) => ({
  user_id: userId,
  slug: c.id,
  label: c.label,
  emoji: c.emoji,
  kind: c.kind,
  is_base: Boolean(c.base),
});

/** `seriesId@2026-08`, o formato que o app usa para ocorrências puladas */
const splitSkip = (key: string) => {
  const at = key.lastIndexOf("@");
  return at < 0 ? null : { series_id: key.slice(0, at), ym: key.slice(at + 1) };
};

/* ----------------------------- perfil ----------------------------- */

export interface Profile {
  name: string;
  /** caminho do arquivo no Storage, ou o base64 antigo de quem ainda não migrou */
  avatar?: string;
  theme: "claro" | "escuro";
  calc: boolean;
  home: string[];
}

const DEFAULT_PROFILE: Profile = {
  name: "",
  theme: "escuro",
  calc: false,
  home: DEFAULT_HOME,
};

/** Cria o perfil e as categorias base na primeira entrada da conta. */
export async function ensureProfile(userId: string, name: string): Promise<Profile> {
  const sb = supabase();
  const { data } = await sb.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (data) {
    return {
      name: data.name ?? name,
      avatar: data.avatar_url ?? undefined,
      theme: data.theme === "claro" ? "claro" : "escuro",
      calc: Boolean(data.calc),
      home: data.home?.length ? data.home : DEFAULT_HOME,
    };
  }

  const profile: Profile = { ...DEFAULT_PROFILE, name };
  const { error } = await sb.from("profiles").insert({
    id: userId,
    name: profile.name,
    theme: profile.theme,
    calc: profile.calc,
    home: profile.home,
  });
  if (error) throw error;

  await sb.from("categories").insert(BASE_CATEGORIES.map((c) => fromCat(c, userId)));
  return profile;
}

export async function saveProfile(userId: string, patch: Partial<Profile>) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  /* "in" e não "!== undefined": passar `avatar: undefined` é justamente o
     pedido de apagar a foto, e com a checagem antiga isso virava nada. */
  if ("avatar" in patch) row.avatar_url = patch.avatar ?? null;
  if (patch.theme !== undefined) row.theme = patch.theme;
  if (patch.calc !== undefined) row.calc = patch.calc;
  if (patch.home !== undefined) row.home = patch.home;
  const { error } = await supabase().from("profiles").update(row).eq("id", userId);
  if (error) throw error;
}

/* ---------------------------- leitura ---------------------------- */

/** Traz a carteira inteira do usuário em quatro consultas paralelas. */
/* ------------------------------ regras ------------------------------ */

interface RegraRow {
  fingerprint: string;
  kind: string | null;
  category: string | null;
  sample: string | null;
  updated_at: string;
}

const toRegra = (r: RegraRow): Regra => ({
  chave: r.fingerprint,
  kind: (r.kind as Regra["kind"]) ?? undefined,
  categoria: r.category ?? undefined,
  exemplo: r.sample ?? "",
  atualizada: r.updated_at,
});

/** As regras que a pessoa ensinou ao conferir extratos. */
export async function loadRules(): Promise<Regra[]> {
  const { data, error } = await supabase().from("import_rules").select("*");
  if (error) throw error;
  return (data ?? []).map((r) => toRegra(r as RegraRow));
}

/** Grava o que acabou de ser ensinado, uma linha por impressão digital. */
export async function saveRules(userId: string, regras: Regra[]) {
  if (!regras.length) return;
  const rows = regras.map((r) => ({
    user_id: userId,
    fingerprint: r.chave,
    kind: r.kind ?? null,
    category: r.categoria ?? null,
    sample: r.exemplo.slice(0, 120),
    updated_at: r.atualizada,
  }));
  const { error } = await supabase()
    .from("import_rules")
    .upsert(rows, { onConflict: "user_id,fingerprint" });
  if (error) throw error;
}

export async function loadLedger(
  userId: string,
  nome = ""
): Promise<{ ledger: Ledger; profile: Profile; regras: Regra[] }> {
  const sb = supabase();
  const profile = await ensureProfile(userId, nome);

  const [tx, series, cats, skips, regras] = await Promise.all([
    sb.from("transactions").select("*").order("date", { ascending: false }),
    sb.from("series").select("*"),
    sb.from("categories").select("*"),
    sb.from("series_skips").select("series_id, ym"),
    sb.from("import_rules").select("*"),
  ]);

  const first = [tx, series, cats, skips].find((r) => r.error);
  if (first?.error) throw first.error;
  /* A tabela de regras é nova. Se o banco de alguém ainda não a tiver, o
     app continua funcionando sem memória, e não morre na abertura. */
  const aprendidas = regras.error ? [] : (regras.data ?? []).map((r) => toRegra(r as RegraRow));

  return {
    profile,
    regras: aprendidas,
    ledger: {
      transactions: (tx.data ?? []).map((r) => toTx(r as TxRow)),
      series: (series.data ?? []).map((r) => toSeries(r as SeriesRow)),
      /* Lista vazia é lista vazia: quem apagou todas as categorias não
         quer vê-las de volta na próxima abertura. A semeadura das
         categorias prontas acontece uma vez só, quando a conta nasce. */
      categories: (cats.data ?? []).map((r) => toCat(r as CatRow)),
      skips: (skips.data ?? []).map((r) => `${r.series_id}@${r.ym}`),
      home: profile.home,
      theme: profile.theme,
      calc: profile.calc,
    },
  };
}

/* ---------------------------- escrita ---------------------------- */

export async function insertTransactions(userId: string, rows: Transaction[]) {
  if (!rows.length) return;
  /* upsert e não insert: o materialize() pode tentar recriar a mesma
     ocorrência de uma série em outra aba. O índice único no banco barra
     a duplicata, e aqui a tentativa repetida simplesmente não faz nada. */
  const { error } = await supabase()
    .from("transactions")
    .upsert(rows.map((t) => fromTx(t, userId)), { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function updateTransaction(id: string, patch: Partial<Transaction>) {
  const row: Record<string, unknown> = {};
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.amount !== undefined) row.amount = patch.amount;
  if (patch.kind !== undefined) row.kind = patch.kind;
  if (patch.category !== undefined) row.category = patch.category;
  if (patch.date !== undefined) row.date = patch.date;
  if (patch.recurrence !== undefined) row.recurrence = patch.recurrence;
  if (patch.installment !== undefined) {
    row.installment_current = patch.installment?.current ?? null;
    row.installment_total = patch.installment?.total ?? null;
  }
  const { error } = await supabase().from("transactions").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteTransactions(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase().from("transactions").delete().in("id", ids);
  if (error) throw error;
}

export async function insertSeries(userId: string, s: Series) {
  const { error } = await supabase().from("series").insert(fromSeries(s, userId));
  if (error) throw error;
}

export async function deleteSeries(seriesId: string) {
  const sb = supabase();
  // a coluna series_id em transactions é "on delete set null", então os
  // lançamentos da série saem antes, para não ficarem órfãos
  const a = await sb.from("transactions").delete().eq("series_id", seriesId);
  if (a.error) throw a.error;
  const b = await sb.from("series_skips").delete().eq("series_id", seriesId);
  if (b.error) throw b.error;
  const c = await sb.from("series").delete().eq("id", seriesId);
  if (c.error) throw c.error;
}

/**
 * Religa lançamentos que apontam para uma categoria inexistente.
 *
 * Acontece com quem importou extrato numa versão em que o id do
 * lançamento e o da categoria nova podiam sair diferentes. Nada é
 * apagado: os lançamentos só passam a apontar para "Outros", que é
 * exatamente o que a tela já mostrava.
 */
export async function reassignCategory(ids: string[], para: string) {
  const sb = supabase();
  // em blocos, para a lista de ids não estourar o tamanho da URL
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await sb
      .from("transactions")
      .update({ category: para })
      .in("id", ids.slice(i, i + 100));
    if (error) throw error;
  }
}

export async function updateSeriesCategory(seriesId: string, category: string) {
  const { error } = await supabase()
    .from("series")
    .update({ tpl_category: category })
    .eq("id", seriesId);
  if (error) throw error;
}

export async function addSkips(userId: string, keys: string[]) {
  const rows = keys
    .map(splitSkip)
    .filter(Boolean)
    .map((r) => ({ ...r!, user_id: userId }));
  if (!rows.length) return;
  const { error } = await supabase()
    .from("series_skips")
    .upsert(rows, { onConflict: "series_id,ym", ignoreDuplicates: true });
  if (error) throw error;
}

export async function saveCategory(userId: string, cat: Category) {
  const { error } = await supabase()
    .from("categories")
    .upsert(fromCat(cat, userId), { onConflict: "user_id,slug" });
  if (error) throw error;
}

/** Apaga a categoria e joga o que era dela para "Outros". */
export async function removeCategory(userId: string, slug: string, fallback: string) {
  const sb = supabase();
  const a = await sb.from("transactions").update({ category: fallback }).eq("category", slug);
  if (a.error) throw a.error;
  const b = await sb.from("series").update({ tpl_category: fallback }).eq("tpl_category", slug);
  if (b.error) throw b.error;
  const c = await sb.from("categories").delete().eq("user_id", userId).eq("slug", slug);
  if (c.error) throw c.error;
}

/** Zera lançamentos, séries e pulos, preservando categorias e preferências. */
export async function wipeLedger(userId: string) {
  const sb = supabase();
  const a = await sb.from("transactions").delete().eq("user_id", userId);
  if (a.error) throw a.error;
  const b = await sb.from("series_skips").delete().eq("user_id", userId);
  if (b.error) throw b.error;
  const c = await sb.from("series").delete().eq("user_id", userId);
  if (c.error) throw c.error;
}

/** Sobe uma carteira inteira de uma vez, usado pela conta de exemplo. */
export async function seedLedger(userId: string, ledger: Ledger) {
  const sb = supabase();

  if (ledger.series.length) {
    const { error } = await sb
      .from("series")
      .insert(ledger.series.map((s) => fromSeries(s, userId)));
    if (error) throw error;
  }

  if (ledger.transactions.length) {
    // em blocos, para não estourar o limite de tamanho da requisição
    for (let i = 0; i < ledger.transactions.length; i += 200) {
      const slice = ledger.transactions.slice(i, i + 200);
      const { error } = await sb.from("transactions").insert(slice.map((t) => fromTx(t, userId)));
      if (error) throw error;
    }
  }

  const extras = ledger.categories.filter(
    (c) => !BASE_CATEGORIES.some((b) => b.id === c.id)
  );
  if (extras.length) {
    const { error } = await sb
      .from("categories")
      .upsert(extras.map((c) => fromCat(c, userId)), { onConflict: "user_id,slug" });
    if (error) throw error;
  }

  if (ledger.skips.length) await addSkips(userId, ledger.skips);
}

/** Usado quando a conta nasce vazia e o app ainda não tem id de lançamento. */
export const newId = uid;
