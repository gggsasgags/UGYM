import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ------------------------------------------------------------------
   Cliente do Supabase.

   O cliente é criado sob demanda, e não no carregamento do módulo, por
   um motivo prático: o site institucional usa o mesmo pacote do
   aplicativo. Se faltar variável de ambiente, a página inicial precisa
   continuar abrindo normalmente; só a parte de conta é que deixa de
   funcionar, com uma mensagem clara.
-------------------------------------------------------------------*/

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true quando as duas variáveis existem e o aplicativo pode falar com o banco */
export const hasSupabase = Boolean(URL && ANON);

export const MISSING_ENV =
  "O aplicativo não está conectado ao servidor. Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.";

/**
 * Quais formas de entrar estão ligadas no projeto.
 *
 * O endpoint é público e não exige sessão. Serve para o app não mostrar um
 * botão que ainda não funciona: enquanto o Google não estiver ativo no
 * painel do Supabase, o botão simplesmente não aparece.
 */
export async function provedores(): Promise<{ google: boolean }> {
  if (!hasSupabase) return { google: false };
  try {
    const r = await fetch(`${URL}/auth/v1/settings`, { headers: { apikey: ANON! } });
    if (!r.ok) return { google: false };
    const j = (await r.json()) as { external?: Record<string, boolean> };
    return { google: Boolean(j.external?.google) };
  } catch {
    return { google: false };
  }
}

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!hasSupabase) throw new Error(MISSING_ENV);
  if (!client) {
    client = createClient(URL!, ANON!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        /* O aplicativo usa rotas com "#", e o fluxo implícito devolve o
           token justamente no "#". O PKCE devolve em "?code=", que não
           colide com o roteador. */
        flowType: "pkce",
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
