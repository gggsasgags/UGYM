/**
 * Teste do contrato com o Supabase real.
 *
 * Reproduz, uma a uma, exatamente as chamadas HTTP que `src/lib/db.ts`
 * emite: mesmas tabelas, mesmas colunas, mesmos alvos de conflito nos
 * upserts. Se o schema ou a RLS estiverem diferentes do esperado, o
 * erro aparece aqui em vez de aparecer para o usuário.
 *
 * Roda com:  node scripts/test-supabase.mjs
 * Lê VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY do .env.local.
 *
 * Cria duas contas de teste para conferir o isolamento por RLS. Elas
 * ficam no seu Authentication > Users e podem ser apagadas à mão; a
 * chave pública não tem permissão para remover usuários.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

/* ---------------------------- preparação ---------------------------- */

const env = {};
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch {
  /* segue com as variáveis do ambiente */
}
const URL_ = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!URL_ || !KEY) {
  console.error("Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (.env.local).");
  process.exit(1);
}

const stamp = Date.now();
const mk = () =>
  createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

let pass = 0;
let fail = 0;
const results = [];
const check = (n, ok, detail = "") => {
  results.push({ n, ok, detail });
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASSOU " : "FALHOU "} ${n}${detail ? "  ->  " + detail : ""}`);
};
const msg = (e) => (e ? e.message || JSON.stringify(e) : "");

const uuid = () => crypto.randomUUID();
const ym = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const today = new Date().toISOString().slice(0, 10);

/* ------------------------------ testes ------------------------------ */

const A = mk();
const B = mk();
const mailA = `gasto-teste-a-${stamp}@testegasto.dev`;
const mailB = `gasto-teste-b-${stamp}@testegasto.dev`;
const SENHA = "senha-de-teste-123";

console.log(`\nProjeto: ${URL_}`);
console.log(`Chave:   ${KEY.slice(0, 18)}…  (${KEY.startsWith("sb_publishable_") ? "formato novo" : "formato antigo"})\n`);

/* 1. cadastro */
const up = await A.auth.signUp({ email: mailA, password: SENHA });
check("1. cadastro de conta nova", !up.error && !!up.data.user, msg(up.error));
if (up.error) { console.log("\nSem conta não dá para seguir. Abortando."); process.exit(1); }

const confirmacaoLigada = !up.data.session;
check(
  "1b. confirmação de e-mail desligada (decisão 1)",
  !confirmacaoLigada,
  confirmacaoLigada ? "o cadastro não devolveu sessão: confirmação ainda está LIGADA" : ""
);

const uidA = up.data.user.id;

/* garante sessão mesmo se a confirmação estiver ligada */
if (confirmacaoLigada) {
  console.log("\nComo a confirmação está ligada, o restante não pode ser testado.");
  console.log("Desligue em Authentication > Providers > Email > Confirm email e rode de novo.\n");
  process.exit(1);
}

/* 2. perfil e categorias base, como ensureProfile() faz */
const p0 = await A.from("profiles").select("*").eq("id", uidA).maybeSingle();
check("2. leitura de profiles (deve vir vazia)", !p0.error && !p0.data, msg(p0.error));

const pIns = await A.from("profiles").insert({
  id: uidA, name: "Teste A", theme: "escuro", calc: false, home: ["calendar", "categories"],
});
check("3. criação do profile (política de INSERT)", !pIns.error, msg(pIns.error));

const cats = await A.from("categories").insert([
  { user_id: uidA, slug: "mercado", label: "Mercado", emoji: "🛒", kind: "despesa", is_base: true },
  { user_id: uidA, slug: "outros", label: "Outros", emoji: "📦", kind: "despesa", is_base: true },
  { user_id: uidA, slug: "salario", label: "Salário", emoji: "💰", kind: "receita", is_base: true },
]);
check("4. categorias base", !cats.error, msg(cats.error));

const pPatch = await A.from("profiles").update({ name: "Diego Teste" }).eq("id", uidA);
check("5. atualização do nome no profile", !pPatch.error, msg(pPatch.error));

/* 6. transação: criar, editar, excluir */
const txId = uuid();
const txIns = await A.from("transactions").insert({
  id: txId, user_id: uidA, description: "Padaria", amount: 23.5, kind: "despesa",
  category: "mercado", date: today, recurrence: "variavel",
  installment_current: null, installment_total: null, series_id: null,
});
check("6. criação de transação", !txIns.error, msg(txIns.error));

const txUpd = await A.from("transactions").update({ description: "Padaria da esquina", amount: 27.9 }).eq("id", txId);
check("7. edição de transação", !txUpd.error, msg(txUpd.error));

const txRead = await A.from("transactions").select("*").eq("id", txId).maybeSingle();
const valorOk = txRead.data && Number(txRead.data.amount) === 27.9 && txRead.data.description === "Padaria da esquina";
check("8. edição refletida na leitura", !!valorOk, txRead.data ? `amount=${txRead.data.amount}` : msg(txRead.error));

/* 9. categoria nova, upsert com o alvo de conflito que o app usa */
const catUp = await A.from("categories").upsert(
  { user_id: uidA, slug: "pet", label: "Pet", emoji: "🐶", kind: "despesa", is_base: false },
  { onConflict: "user_id,slug" }
);
check("9. criação de categoria (upsert user_id,slug)", !catUp.error, msg(catUp.error));

const catUp2 = await A.from("categories").upsert(
  { user_id: uidA, slug: "pet", label: "Pet e veterinário", emoji: "🐶", kind: "despesa", is_base: false },
  { onConflict: "user_id,slug" }
);
check("10. renomear categoria pelo mesmo upsert", !catUp2.error, msg(catUp2.error));

/* 11. recorrência mensal */
const serieMensal = uuid();
const sm = await A.from("series").insert({
  id: serieMensal, user_id: uidA, kind: "mensal", start_ym: ym(), total: null, ended_ym: null,
  tpl_description: "Plano de saúde", tpl_amount: 340, tpl_kind: "despesa",
  tpl_category: "outros", tpl_recurrence: "fixo", tpl_day: 10,
});
check("11. série mensal", !sm.error, msg(sm.error));

const ocorrencia = uuid();
const smTx = await A.from("transactions").upsert([{
  id: ocorrencia, user_id: uidA, description: "Plano de saúde", amount: 340, kind: "despesa",
  category: "outros", date: `${ym()}-10`, recurrence: "fixo",
  installment_current: null, installment_total: null, series_id: serieMensal,
}], { onConflict: "id", ignoreDuplicates: true });
check("12. ocorrência da série mensal", !smTx.error, msg(smTx.error));

/* 13. o índice único contra duplicação, com outro id no mesmo mês */
const dup = await A.from("transactions").upsert([{
  id: uuid(), user_id: uidA, description: "Plano de saúde", amount: 340, kind: "despesa",
  category: "outros", date: `${ym()}-10`, recurrence: "fixo",
  installment_current: null, installment_total: null, series_id: serieMensal,
}], { onConflict: "id", ignoreDuplicates: true });
const barrou = Boolean(dup.error);
check("13. índice único barra ocorrência duplicada da mesma série", barrou,
  barrou ? `barrado como esperado: ${msg(dup.error).slice(0, 80)}` : "NÃO barrou: duas linhas para o mesmo mês");

/* 14. parcelamento */
const serieParc = uuid();
const sp = await A.from("series").insert({
  id: serieParc, user_id: uidA, kind: "parcelado", start_ym: ym(), total: 10, ended_ym: null,
  tpl_description: "Notebook", tpl_amount: 250, tpl_kind: "despesa",
  tpl_category: "outros", tpl_recurrence: "fixo", tpl_day: 5,
});
check("14. série parcelada", !sp.error, msg(sp.error));

const parcelas = await A.from("transactions").upsert(
  [1, 2, 3].map((n) => ({
    id: uuid(), user_id: uidA, description: "Notebook", amount: 250, kind: "despesa",
    category: "outros", date: `${ym(new Date(new Date().setMonth(new Date().getMonth() + n - 1)))}-05`,
    recurrence: "fixo", installment_current: n, installment_total: 10, series_id: serieParc,
  })), { onConflict: "id", ignoreDuplicates: true }
);
check("15. parcelas 1/10 a 3/10", !parcelas.error, msg(parcelas.error));

const pRead = await A.from("transactions").select("installment_current, installment_total").eq("series_id", serieParc);
const parcOk = pRead.data?.length === 3 && pRead.data.every((r) => r.installment_total === 10);
check("16. numeração das parcelas gravada", !!parcOk, pRead.data ? `${pRead.data.length} parcelas` : msg(pRead.error));

/* 17. pulos de série */
const skip = await A.from("series_skips").upsert(
  [{ series_id: serieMensal, ym: ym(), user_id: uidA }],
  { onConflict: "series_id,ym", ignoreDuplicates: true }
);
check("17. registro de ocorrência pulada (upsert series_id,ym)", !skip.error, msg(skip.error));

/* 18. tema */
const tema = await A.from("profiles").update({ theme: "claro" }).eq("id", uidA);
const temaRead = await A.from("profiles").select("theme").eq("id", uidA).maybeSingle();
check("18. troca de tema persistida", !tema.error && temaRead.data?.theme === "claro",
  tema.error ? msg(tema.error) : `theme=${temaRead.data?.theme}`);

/* 19. exclusão de transação */
const txDel = await A.from("transactions").delete().in("id", [txId]);
const txGone = await A.from("transactions").select("id").eq("id", txId);
check("19. exclusão de transação", !txDel.error && txGone.data?.length === 0, msg(txDel.error));

/* 20 a 23. isolamento por RLS */
const upB = await B.auth.signUp({ email: mailB, password: SENHA });
check("20. segunda conta criada", !upB.error && !!upB.data.session, msg(upB.error));

if (upB.data?.session) {
  const uidB = upB.data.user.id;
  await B.from("profiles").insert({ id: uidB, name: "Teste B", theme: "escuro", calc: false, home: [] });

  const leu = await B.from("transactions").select("*");
  check("21. RLS: B não enxerga lançamentos de A", leu.data?.length === 0,
    leu.error ? msg(leu.error) : `B viu ${leu.data?.length} linhas`);

  const leuCat = await B.from("categories").select("*");
  check("22. RLS: B não enxerga categorias de A", leuCat.data?.length === 0,
    leuCat.error ? msg(leuCat.error) : `B viu ${leuCat.data?.length} linhas`);

  const leuPerfil = await B.from("profiles").select("*").eq("id", uidA);
  check("23. RLS: B não enxerga o perfil de A", leuPerfil.data?.length === 0,
    leuPerfil.error ? msg(leuPerfil.error) : `B viu ${leuPerfil.data?.length} linhas`);

  const escreveu = await B.from("transactions").insert({
    id: uuid(), user_id: uidA, description: "Invasão", amount: 1, kind: "despesa",
    category: "outros", date: today, recurrence: "variavel",
  });
  check("24. RLS: B não consegue gravar em nome de A", Boolean(escreveu.error),
    escreveu.error ? "recusado como esperado" : "GRAVOU: a política de INSERT está frouxa");

  const apagou = await B.from("transactions").delete().eq("series_id", serieMensal);
  const aindaLa = await A.from("transactions").select("id").eq("series_id", serieMensal);
  check("25. RLS: B não consegue apagar dados de A", (aindaLa.data?.length ?? 0) > 0,
    apagou.error ? msg(apagou.error) : `restaram ${aindaLa.data?.length} linhas de A`);
}

/* 26. logout */
const out = await A.auth.signOut();
const semSessao = await A.auth.getSession();
check("26. logout encerra a sessão", !out.error && !semSessao.data.session, msg(out.error));

/* ----------------------------- limpeza ----------------------------- */
const A2 = mk();
await A2.auth.signInWithPassword({ email: mailA, password: SENHA });
await A2.from("transactions").delete().eq("user_id", uidA);
await A2.from("series_skips").delete().eq("user_id", uidA);
await A2.from("series").delete().eq("user_id", uidA);
await A2.from("categories").delete().eq("user_id", uidA);
await A2.from("profiles").delete().eq("id", uidA);
await A2.auth.signOut();

console.log(`\n${pass} passaram, ${fail} falharam.`);
if (fail) {
  console.log("\nFalhas:");
  for (const r of results.filter((r) => !r.ok)) console.log(`  - ${r.n}: ${r.detail}`);
}
console.log(`\nAs duas contas de teste (${mailA} e ${mailB}) ficaram no Authentication > Users.`);
console.log("Apague à mão quando quiser; a chave pública não remove usuários.\n");
process.exit(fail ? 1 : 0);
