/**
 * Supabase de mentira, só para os testes de cliente.
 *
 * Responde ao subconjunto de GoTrue e PostgREST que `src/lib/db.ts` usa,
 * guardando tudo em memória. Serve para testar o que é nosso: sessão que
 * sobrevive ao reload, escrita otimista, reversão e aviso quando a rede
 * falha. O contrato de schema e a RLS são testados contra o Supabase real.
 *
 *   node mock/server.mjs <porta>
 *
 * Endpoint extra de controle:
 *   POST /__falhar   { "on": true }   faz toda escrita responder 500
 */
import { createServer } from "node:http";

const PORT = Number(process.argv[2] || 54321);
const db = { profiles: [], transactions: [], series: [], categories: [], series_skips: [] };
const users = new Map(); // email -> { id, password }
const sessions = new Map(); // token -> userId
let falhar = false;
let confirmarEmail = false;

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(sub) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, exp, role: "authenticated", aud: "authenticated" })}.assinatura`;
}
const userOf = (req) => {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  return sessions.get(t) || null;
};
const send = (res, code, body, extra = {}) => {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    ...extra,
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const body = (req) =>
  new Promise((ok) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      try { ok(s ? JSON.parse(s) : {}); } catch { ok({}); }
    });
  });

/** traduz `id=eq.x`, `id=in.(a,b)`, `date=gte.x` do PostgREST */
function filtrar(rows, params) {
  return rows.filter((r) =>
    [...params].every(([col, val]) => {
      if (["select", "order", "limit", "offset", "on_conflict", "columns", "apikey"].includes(col)) return true;
      const [op, ...rest] = String(val).split(".");
      const alvo = rest.join(".");
      const v = r[col];
      if (op === "eq") return String(v) === alvo;
      if (op === "neq") return String(v) !== alvo;
      if (op === "is") return alvo === "null" ? v == null : String(v) === alvo;
      if (op === "in") return alvo.replace(/^\(|\)$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "")).includes(String(v));
      if (op === "gte") return String(v) >= alvo;
      if (op === "lte") return String(v) <= alvo;
      return true;
    })
  );
}

const CHAVES = {
  profiles: ["id"],
  transactions: ["id"],
  series: ["id"],
  categories: ["user_id", "slug"],
  series_skips: ["series_id", "ym"],
};
const mesmaChave = (tabela, a, b, onConflict) => {
  const cols = onConflict ? onConflict.split(",") : CHAVES[tabela];
  return cols.every((c) => String(a[c]) === String(b[c]));
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") return send(res, 204);

  /* ------------------------- controle do teste ------------------------- */
  if (url.pathname === "/__falhar") {
    const b = await body(req);
    falhar = Boolean(b.on);
    return send(res, 200, { falhar });
  }
  if (url.pathname === "/__estado") return send(res, 200, db);
  if (url.pathname === "/__confirmar") {
    const b = await body(req);
    confirmarEmail = Boolean(b.on);
    return send(res, 200, { confirmarEmail });
  }
  /* Planta linhas direto na tabela, sem passar pelo app. Serve para
     recriar estados que o app de hoje não consegue mais produzir, como
     um lançamento apontando para categoria que não existe. */
  if (url.pathname === "/__plantar") {
    const b = await body(req);
    const dono = [...users.values()].at(-1)?.id;
    if (!dono) return send(res, 400, { erro: "nenhuma conta criada ainda" });
    for (const linha of b.transactions ?? []) {
      db.transactions.push({ ...linha, user_id: dono });
    }
    return send(res, 200, { plantados: (b.transactions ?? []).length, dono });
  }
  if (url.pathname === "/__zerar") {
    for (const k of Object.keys(db)) db[k] = [];
    users.clear();
    sessions.clear();
    falhar = false;
    confirmarEmail = false;
    return send(res, 200, { zerado: true });
  }

  /* ------------------------------ GoTrue ------------------------------ */
  if (url.pathname.startsWith("/auth/v1/")) {
    const rota = url.pathname.slice("/auth/v1/".length);
    const b = await body(req);

    if (rota === "signup") {
      if (users.has(b.email)) return send(res, 400, { msg: "User already registered", error_code: "user_already_exists" });
      const id = crypto.randomUUID();
      users.set(b.email, { id, password: b.password, meta: b.data || {} });
      const user = { id, email: b.email, aud: "authenticated", role: "authenticated", created_at: new Date().toISOString(), app_metadata: {}, user_metadata: b.data || {} };
      /* Com confirmação ligada o GoTrue devolve o usuário sem sessão: é
         assim que o app sabe que precisa esperar o clique no e-mail. */
      if (confirmarEmail) return send(res, 200, { ...user, identities: [] });
      const token = jwt(id);
      sessions.set(token, id);
      return send(res, 200, { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "refresh-" + id, user });
    }

    if (rota === "token") {
      const grant = url.searchParams.get("grant_type");
      let id = null;
      if (grant === "refresh_token") id = String(b.refresh_token || "").replace(/^refresh-/, "");
      else {
        const u = users.get(b.email);
        if (!u || u.password !== b.password) return send(res, 400, { msg: "Invalid login credentials", error_code: "invalid_credentials" });
        id = u.id;
      }
      const achado = [...users.entries()].find(([, u]) => u.id === id);
      if (!achado) return send(res, 400, { msg: "Invalid Refresh Token" });
      const [email, dono] = achado;
      const token = jwt(id);
      sessions.set(token, id);
      return send(res, 200, { access_token: token, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "refresh-" + id, user: { id, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: dono.meta || {} } });
    }

    if (rota === "resend") return send(res, 200, {});

    if (rota === "logout") {
      const h = req.headers.authorization || "";
      sessions.delete(h.slice(7));
      return send(res, 204);
    }

    /* PUT /user é o updateUser do supabase-js: o app usa para apagar a
       marca de "subir dados de exemplo" depois de usá-la. */
    if (rota === "user") {
      const id = userOf(req);
      if (!id) return send(res, 401, { msg: "invalid claim" });
      const achado = [...users.entries()].find(([, u]) => u.id === id);
      if (!achado) return send(res, 401, { msg: "invalid claim" });
      const [email, dono] = achado;
      if (req.method === "PUT" && b.data) dono.meta = { ...(dono.meta || {}), ...b.data };
      return send(res, 200, { id, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: dono.meta || {} });
    }

    return send(res, 200, {});
  }

  /* ---------------------------- PostgREST ---------------------------- */
  if (url.pathname.startsWith("/rest/v1/")) {
    const tabela = url.pathname.slice("/rest/v1/".length);
    if (!(tabela in db)) return send(res, 404, { message: `relation "${tabela}" does not exist` });

    const uid = userOf(req);
    if (!uid) return send(res, 401, { message: "JWT expired or missing" });

    const escrita = req.method !== "GET";
    if (escrita && falhar) return send(res, 500, { message: "servidor de teste com falha simulada" });

    const meus = () => db[tabela].filter((r) => (r.user_id ?? r.id) === uid);
    const prefer = req.headers.prefer || "";

    if (req.method === "GET") {
      let rows = filtrar(meus(), url.searchParams);
      const ord = url.searchParams.get("order");
      if (ord) {
        const [col, dir] = ord.split(".");
        rows = [...rows].sort((a, x) => (String(a[col]) < String(x[col]) ? -1 : 1) * (dir === "desc" ? -1 : 1));
      }
      return send(res, 200, rows);
    }

    if (req.method === "POST") {
      const b = await body(req);
      const linhas = Array.isArray(b) ? b : [b];
      const onConflict = url.searchParams.get("on_conflict");
      const ignora = prefer.includes("ignore-duplicates");
      const funde = prefer.includes("merge-duplicates");

      for (const linha of linhas) {
        if (linha.user_id && linha.user_id !== uid) return send(res, 403, { message: "new row violates row-level security policy" });
        if (tabela === "profiles" && linha.id !== uid) return send(res, 403, { message: "new row violates row-level security policy" });
        const i = db[tabela].findIndex((r) => mesmaChave(tabela, r, linha, onConflict));
        if (i >= 0) {
          if (ignora) continue;
          if (funde) { db[tabela][i] = { ...db[tabela][i], ...linha }; continue; }
          return send(res, 409, { message: "duplicate key value violates unique constraint", code: "23505" });
        }
        db[tabela].push({ ...linha, user_id: linha.user_id ?? uid });
      }
      return send(res, 201, prefer.includes("return=minimal") ? undefined : linhas);
    }

    if (req.method === "PATCH") {
      const b = await body(req);
      const alvo = filtrar(meus(), url.searchParams);
      for (const r of alvo) Object.assign(r, b);
      return send(res, 204);
    }

    if (req.method === "DELETE") {
      const alvo = new Set(filtrar(meus(), url.searchParams));
      db[tabela] = db[tabela].filter((r) => !alvo.has(r));
      return send(res, 204);
    }
  }

  send(res, 404, { message: "sem rota" });
}).listen(PORT, () => console.log("supabase de mentira em http://127.0.0.1:" + PORT));
