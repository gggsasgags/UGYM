import { limparVitrine } from "./db-vitrine";

/* ------------------------------------------------------------------
   A conta da vitrine.

   Sósia do supabase.ts: mesmas exportações, nenhuma rede. Serve para o
   artefato, que roda numa caixa sem saída para a internet e por isso
   nunca alcançaria o Supabase de verdade.

   O que ela faz de propósito:

   - qualquer e-mail e qualquer senha entram, porque a vitrine existe
     para olhar as telas, e não para testar autenticação;
   - a primeira entrada nasce com a marca `exemplo`, que é a mesma marca
     do app de verdade. Assim quem seed a carteira de demonstração é o
     código real do store, e não uma gambiarra daqui;
   - `apagar_minha_conta` responde como o servidor responderia depois do
     SQL instalado, e limpa a vitrine. No site de verdade isso depende da
     função no banco; aqui é simulação declarada.

   Nada disto entra na construção normal. A troca acontece só no modo
   "vitrine" do vite.config.ts.
-------------------------------------------------------------------*/

export const hasSupabase = true;

export const MISSING_ENV =
  "O aplicativo não está conectado ao servidor. Faltam as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.";

/* Sem Google na vitrine: o botão some sozinho, porque o app já pergunta
   quais provedores existem antes de mostrá-lo. */
export async function provedores(): Promise<{ google: boolean }> {
  return { google: false };
}

interface Usuario {
  id: string;
  email: string;
  created_at: string;
  user_metadata: { nome?: string; exemplo?: boolean; full_name?: string; name?: string };
}

const CHAVE = "gasto-vitrine-sessao";
const ID = "vitrine-0000-0000-0000";

let sessao: Usuario | null = null;
let lido = false;

function usuario(): Usuario | null {
  if (!lido) {
    lido = true;
    try {
      const cru = localStorage.getItem(CHAVE);
      sessao = cru ? (JSON.parse(cru) as Usuario) : null;
    } catch {
      sessao = null;
    }
  }
  return sessao;
}

function guardar(u: Usuario | null): void {
  sessao = u;
  lido = true;
  try {
    if (u) localStorage.setItem(CHAVE, JSON.stringify(u));
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: a sessão vale enquanto a aba viver */
  }
}

function nascer(email: string, dados: Record<string, unknown> = {}): Usuario {
  const limpo = email.trim().toLowerCase() || "voce@exemplo.com";
  const u: Usuario = {
    id: ID,
    email: limpo,
    created_at: new Date().toISOString(),
    user_metadata: {
      nome: limpo.split("@")[0],
      /* a marca que faz o store semear a carteira de exemplo */
      exemplo: true,
      ...dados,
    },
  };
  guardar(u);
  return u;
}

type Ouvinte = (evento: string) => void;
const ouvintes: Ouvinte[] = [];
const avisar = (evento: string) => {
  for (const o of ouvintes) o(evento);
};

const semErro = { error: null };

const cliente = {
  auth: {
    onAuthStateChange(cb: Ouvinte) {
      ouvintes.push(cb);
      return {
        data: {
          subscription: {
            unsubscribe() {
              const i = ouvintes.indexOf(cb);
              if (i >= 0) ouvintes.splice(i, 1);
            },
          },
        },
      };
    },

    async getSession() {
      const u = usuario();
      return { data: { session: u ? { user: u } : null }, error: null };
    },

    async signUp({ email, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
      const u = nascer(email, options?.data ?? {});
      return { data: { user: u, session: { user: u } }, error: null };
    },

    async signInWithPassword({ email }: { email: string; password: string }) {
      const u = usuario() ?? nascer(email);
      return { data: { user: u, session: { user: u } }, error: null };
    },

    async signInWithOAuth() {
      return { data: null, error: { message: "Entrar com o Google não existe na vitrine." } };
    },

    async resend() {
      return semErro;
    },

    async resetPasswordForEmail() {
      return semErro;
    },

    async updateUser(patch: { data?: Record<string, unknown>; password?: string }) {
      const u = usuario();
      if (u && patch.data) {
        u.user_metadata = { ...u.user_metadata, ...patch.data };
        guardar(u);
      }
      return { data: { user: u }, error: null };
    },

    async signOut() {
      guardar(null);
      avisar("SIGNED_OUT");
      return semErro;
    },
  },

  async rpc(nome: string) {
    if (nome === "apagar_minha_conta") {
      limparVitrine();
      guardar(null);
      return semErro;
    }
    return { error: { message: `Função ${nome} não existe na vitrine.`, code: "PGRST202" } };
  },
};

export function supabase(): typeof cliente {
  return cliente;
}

/* --------------------- o aviso na tela de entrar --------------------- */

/* A vitrine precisa se anunciar, senão alguém tenta a senha de verdade e
   acha que o app está quebrado. O aviso aparece só nas telas de conta e
   não recebe clique, então não atrapalha nada. */
function aviso(): void {
  if (typeof document === "undefined") return;

  const caixa = document.createElement("div");
  caixa.textContent = "VITRINE · dados de exemplo · qualquer e-mail e senha entram";
  caixa.style.cssText = [
    "position:fixed",
    "left:50%",
    "top:12px",
    "transform:translateX(-50%)",
    "z-index:2147483647",
    "pointer-events:none",
    "max-width:calc(100% - 24px)",
    "padding:7px 13px",
    "border-radius:999px",
    "background:rgba(18,251,61,.12)",
    "border:1px solid rgba(18,251,61,.35)",
    "color:#12fb3d",
    "font:500 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace",
    "letter-spacing:.08em",
    "text-align:center",
    "white-space:nowrap",
    "overflow:hidden",
    "text-overflow:ellipsis",
  ].join(";");

  const rever = () => {
    const conta = /^#\/(entrar|criar-conta|nova-senha)/.test(window.location.hash);
    caixa.style.display = conta ? "block" : "none";
  };

  const pendurar = () => {
    document.body.appendChild(caixa);
    rever();
  };

  if (document.body) pendurar();
  else window.addEventListener("DOMContentLoaded", pendurar);

  /* O roteador do app troca de tela por pushState, e pushState não dispara
     hashchange. Por isso o aviso também confere sozinho, de meio em meio
     segundo: é barato, e sem isso ele fica pendurado dentro do app. */
  window.addEventListener("hashchange", rever);
  window.addEventListener("popstate", rever);
  setInterval(rever, 500);
}

aviso();
