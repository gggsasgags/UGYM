import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,  } from "react";
import type { Account, Category, Kind, Ledger, Recurrence, Transaction } from "./types";
import { BASE_CATEGORIES, slugify } from "./categories";
import { DEFAULT_HOME } from "./home";
import { demoLedger } from "./demo";
import { buildSeries, materialize, skipKey, uid } from "./series";
import { aprenderDaEdicao, fundir, type Regra } from "./regras";

/* ------------------------------------------------------------------
   Camada de dados: Supabase.

   A regra que guia este arquivo é que a interface pública do store não
   mudou em nada quando saímos do localStorage. As telas continuam
   chamando `add`, `remove`, `setTheme` do mesmo jeito.

   O que mudou é o miolo. Antes toda alteração reescrevia a carteira
   inteira; agora cada operação altera só a linha que mudou. E como
   rede falha, toda escrita é otimista: o estado local muda na hora,
   a tela responde instantaneamente e, se o servidor recusar, o estado
   volta ao que era e um aviso aparece. Nenhuma alteração financeira
   pode falhar em silêncio.

   Tanto o cliente do Supabase quanto este módulo de banco são
   carregados sob demanda, então a página inicial do site não paga o
   peso de uma biblioteca que ela não usa.
-------------------------------------------------------------------*/

const sbMod = () => import("./supabase");
const dbMod = () => import("./db");
const avMod = () => import("./avatar");

type Db = Awaited<ReturnType<typeof dbMod>>;

const EMPTY: Ledger = {
  transactions: [],
  series: [],
  skips: [],
  categories: BASE_CATEGORIES,
  home: DEFAULT_HOME,
  theme: "escuro",
  calc: false,
};

/* ------------------------------------------------------------------
   O retrato da última carteira, guardado no próprio navegador.

   O Diego descreveu a abertura do app em 13/10/2026 e são três estados:
   tela branca, app sem dados, dados aparecem. O primeiro é o download do
   código, e contra ele só dá para encolher o pacote. O segundo é tempo
   de rede: o app já desenhou, mas está esperando a sessão e a consulta
   ao banco, e nesse intervalo mostra uma carteira vazia que não é
   verdade.

   Esse segundo estado some com um retrato. A última carteira conhecida
   fica no navegador e é pintada na hora, antes de qualquer rede. Quando
   a resposta do banco chega, ela substitui o retrato.

   Três cuidados, que são o que torna isso seguro:

     · o retrato só é lido se existir uma sessão guardada pelo Supabase.
       Sem sessão, não pinta nada, então ninguém vê dado de ninguém numa
       conta deslogada;

     · ele guarda o id do dono. Se a sessão que voltar for de outra
       pessoa, o retrato é descartado sem ser usado;

     · sair da conta apaga. Em qualquer dos dois caminhos, o botão de
       sair e o evento SIGNED_OUT da própria biblioteca.

   Isto não é "voltar para o localStorage" como fonte da verdade: a
   fonte continua sendo o banco, e isto aqui é só a primeira pintura.
-------------------------------------------------------------------*/

const CACHE = "gasto:carteira";
/* Acima disso não vale a pena: escrever meio mega a cada mudança custa
   mais do que a espera que a gente está tentando evitar. */
const CACHE_MAX = 1_500_000;

const temSessaoGuardada = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      /* a biblioteca monta a chave como sb-<ref>-auth-token, e às vezes
         quebra ela em sufixos numerados quando a sessão é grande */
      if (k && k.startsWith("sb-") && k.includes("-auth-token")) return true;
    }
  } catch {
    /* navegador sem storage, ou modo privado trancado */
  }
  return false;
};

interface Retrato {
  userId: string;
  account: Account;
  ledger: Ledger;
}

const lerRetrato = (): Retrato | null => {
  if (!temSessaoGuardada()) return null;
  try {
    const cru = localStorage.getItem(CACHE);
    if (!cru) return null;
    const r = JSON.parse(cru) as Retrato;
    if (!r?.userId || !r?.account || !r?.ledger?.categories) return null;
    return r;
  } catch {
    return null;
  }
};

const gravarRetrato = (userId: string, account: Account, ledger: Ledger) => {
  try {
    const texto = JSON.stringify({ userId, account, ledger });
    if (texto.length > CACHE_MAX) return;
    localStorage.setItem(CACHE, texto);
  } catch {
    /* cota cheia ou storage bloqueado: o app funciona igual, só abre
       mostrando vazio por um instante, que é como era antes */
  }
};

const apagarRetrato = () => {
  try {
    localStorage.removeItem(CACHE);
  } catch {
    /* idem */
  }
};

/** Mensagens do Supabase vêm em inglês; o app fala português. */
function humanError(e: unknown): string {
  /* O PostgREST devolve objeto simples, não instância de Error, então
     olhar só para `instanceof Error` transformaria tudo em "[object
     Object]" na cara do usuário. */
  const raw =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e !== null && "message" in e
      ? String((e as { message: unknown }).message)
      : typeof e === "string"
      ? e
      : "";
  const m = raw.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. O link foi enviado no cadastro.";
  }
  /* O projeto exige 8 caracteres, com letra e número. O Supabase recusa em
     inglês e com a lista de caracteres aceitos, que não ajuda ninguém. */
  if (
    m.includes("password should be at least") ||
    m.includes("password should contain") ||
    m.includes("weak password") ||
    m.includes("weak_password")
  ) {
    return "A senha precisa ter pelo menos 8 caracteres, com pelo menos uma letra e um número.";
  }
  if (m.includes("rate limit") || m.includes("too many") || m.includes("for security purposes")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }
  if (m.includes("invalid or has expired") || m.includes("token has expired")) {
    return "Este link não vale mais. Peça um novo e tente de novo.";
  }
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) {
    return "Não conseguimos falar com o servidor. Verifique sua conexão.";
  }
  /* Daqui para baixo, nada de devolver a mensagem original. Quando o erro
     vem do PostgREST, ela costuma trazer nome de coluna, nome de constraint
     ou o texto de uma política RLS, que é o desenho do banco entregue de
     graça a quem estiver olhando. O detalhe fica no console, e só em
     desenvolvimento. */
  if (import.meta.env.DEV && raw) console.warn("[gastô] erro original:", raw);
  return "Algo deu errado. Tente de novo.";
}

/**
 * Conserta lançamentos que apontam para uma categoria que não existe.
 *
 * Uma versão antiga da importação de extrato conseguia gravar um
 * lançamento com um id de categoria e criar a categoria com outro. O
 * resultado aparecia no modo planilha como várias linhas chamadas
 * "Outros", uma para cada id perdido. A tela já foi corrigida para
 * juntá-las, e aqui o dado é acertado de vez.
 *
 * Só roda quando a lista de categorias veio preenchida. Com a lista
 * vazia, tudo pareceria órfão e o conserto viraria um estrago.
 */
async function repararCategorias(db: Db, ledger: Ledger): Promise<Ledger> {
  const existe = new Set(ledger.categories.map((c) => c.id));
  if (!existe.size) return ledger;

  const orfaos = ledger.transactions.filter((t) => !existe.has(t.category));
  const series = ledger.series.filter((s) => !existe.has(s.template.category));
  if (!orfaos.length && !series.length) return ledger;

  const destino = existe.has("outros") ? "outros" : ledger.categories[0].id;

  try {
    if (orfaos.length) await db.reassignCategory(orfaos.map((t) => t.id), destino);
    for (const s of series) await db.updateSeriesCategory(s.id, destino);
  } catch {
    /* Não conseguiu gravar: a tela continua mostrando tudo junto em
       "Outros" do mesmo jeito, e na próxima abertura tenta de novo. */
    return ledger;
  }

  const orfao = new Set(orfaos.map((t) => t.id));
  const daSerie = new Set(series.map((s) => s.id));
  return {
    ...ledger,
    transactions: ledger.transactions.map((t) =>
      orfao.has(t.id) ? { ...t, category: destino } : t
    ),
    series: ledger.series.map((s) =>
      daSerie.has(s.id) ? { ...s, template: { ...s.template, category: destino } } : s
    ),
  };
}

export interface NewEntry {
  description: string;
  amount: number;
  kind: Kind;
  category: string;
  date: string;
  recurrence: Recurrence;
  repeat: "none" | "mensal" | "parcelado";
  installments?: number;
  /** mês da última ocorrência, quando a pessoa marcou até quando o fixo vai */
  ateYM?: string;
  /** em qual parcela a compra já está, lido do "5 de 6" que ela escreveu */
  comecaEm?: number;
}

export type AuthResult =
  | { ok: true }
  /** `confirm` marca o cadastro que deu certo mas está esperando o clique no e-mail */
  | { ok: false; error: string; confirm?: true };

export interface CalcTape {
  shown: string;
  acc: number | null;
  op: string | null;
  fresh: boolean;
  memo: string;
}

export const EMPTY_TAPE: CalcTape = { shown: "0", acc: null, op: null, fresh: true, memo: "" };

interface Store {
  ready: boolean;
  account: Account | null;
  ledger: Ledger;
  transactions: Transaction[];
  categories: Category[];
  home: string[];
  theme: "claro" | "escuro";
  calc: boolean;
  /** estado da calculadora, só na memória: recarregar o app zera */
  calcOpen: boolean;
  calcTape: CalcTape;
  /** aviso de falha de gravação; nulo quando está tudo certo */
  notice: string | null;
  /** mostra um aviso na barra de cima da tela */
  showNotice(texto: string): void;
  dismissNotice(): void;
  setCalcOpen(v: boolean): void;
  setCalcTape(v: CalcTape): void;
  setTheme(v: "claro" | "escuro"): void;
  setCalc(v: boolean): void;
  signUp(name: string, email: string, password: string, withDemo: boolean): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  /** reenvia o e-mail de confirmação de um cadastro que ficou pendente */
  resendConfirmation(email: string): Promise<AuthResult>;
  /** manda o usuário para o Google; a volta cai em /entrar com a sessão pronta */
  signInWithGoogle(): Promise<AuthResult>;
  /**
   * Pede o e-mail de recuperação de senha.
   *
   * Responde sempre `{ ok: true }`, inclusive quando o e-mail não existe.
   * É de propósito: qualquer diferença de resposta contaria para um estranho
   * se aquele endereço tem conta aqui.
   */
  pedirNovaSenha(email: string): Promise<AuthResult>;
  /** grava a senha nova; só funciona com a sessão que veio do link do e-mail */
  definirSenha(senha: string): Promise<AuthResult>;
  /**
   * Verdadeiro só quando esta sessão nasceu do link de recuperação.
   *
   * Quem liga é o evento `PASSWORD_RECOVERY`, disparado pela biblioteca do
   * Supabase depois de trocar o código do link pela sessão. Nada na URL
   * liga isso: abrir /nova-senha na mão, com ou sem "?code=" inventado,
   * não produz o evento. A marca vive só em memória, some ao recarregar e
   * nunca é gravada em lugar nenhum.
   *
   * Ela serve para a tela não oferecer um formulário que iria falhar. Quem
   * autoriza de verdade é o Supabase, com "Secure password change" e
   * "Require current password when updating" ligados no projeto.
   */
  recuperacao: boolean;
  signOut(): void;
  /**
   * Apaga a conta inteira e sai. Quem faz o trabalho é uma função no
   * banco: o navegador não tem, e não pode ter, privilégio para remover
   * uma linha de auth.users. A função descobre o dono pela sessão, então
   * não existe parâmetro com o id de ninguém para alguém adulterar.
   */
  apagarConta(): Promise<AuthResult>;
  /**
   * `undefined` quando ninguém mexeu na foto, `null` para remover e um
   * Blob quando escolheram uma nova. O arquivo vai para o Storage; a
   * tabela guarda só o caminho.
   */
  setAvatar(foto: Blob | null | undefined): void;
  setName(name: string): void;
  add(entry: NewEntry): void;
  addMany(rows: Omit<Transaction, "id">[]): void;
  /**
   * A importação inteira numa escrita só.
   *
   * Categorias novas, lançamentos novos e os que viram movimentação
   * porque o outro lado da transferência acabou de chegar. Chamar
   * `saveCategory`, `update` e `addMany` em sequência não funcionaria:
   * cada uma monta o próximo estado a partir do estado do render, e sem
   * render entre elas só a última sobreviveria na tela.
   */
  /** o que a pessoa ensinou ao conferir extratos, aplicado na próxima importação */
  regras: Regra[];
  importar(
    rows: Omit<Transaction, "id">[],
    novasCategorias: Category[],
    virarMovimentacao: string[],
    novasRegras: Regra[]
  ): void;
  update(id: string, patch: Partial<Transaction>): void;
  remove(id: string): void;
  removeSeries(seriesId: string): void;
  removeMonth(ym: string): void;
  saveCategory(cat: Omit<Category, "base"> & { base?: boolean }): string;
  removeCategory(id: string): void;
  /** traz de volta as categorias prontas que foram apagadas, sem mexer no resto */
  restoreBaseCategories(): void;
  setHome(ids: string[]): void;
  clearAll(): void;
  loadDemo(): void;
}

const Ctx = createContext<Store | null>(null);

export { DEFAULT_HOME };

export function StoreProvider({ children }: { children: ReactNode }) {
  /* Lido uma vez, antes da primeira pintura. */
  const [retrato] = useState(lerRetrato);
  const [ready, setReady] = useState(false);
  /* O que a pessoa já ensinou ao Gastô sobre as linhas do extrato dela. */
  const [regras, setRegras] = useState<Regra[]>([]);
  const regrasRef = useRef<Regra[]>([]);
  const [account, setAccount] = useState<Account | null>(retrato?.account ?? null);
  const [ledger, setLedger] = useState<Ledger>(retrato?.ledger ?? EMPTY);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcTape, setCalcTape] = useState<CalcTape>(EMPTY_TAPE);
  const [notice, setNotice] = useState<string | null>(null);
  /* a marca de recuperação: estado para a tela, ref para as ações, que
     leem fora do ciclo de render */
  const [recuperacao, setRecuperacao] = useState(false);
  const recuperacaoRef = useRef(false);
  const marcarRecuperacao = useCallback((v: boolean) => {
    recuperacaoRef.current = v;
    setRecuperacao(v);
  }, []);

  /* o estado mais recente, para o desfazer não pegar uma cópia velha */
  const snapshot = useRef(ledger);
  snapshot.current = ledger;
  const accountRef = useRef<Account | null>(null);
  accountRef.current = account;

  /**
   * Escrita otimista: aplica na tela, tenta gravar e, se falhar,
   * devolve o estado anterior e mostra o motivo.
   */
  const write = useCallback((next: Ledger, job: (db: Db, userId: string) => Promise<void>) => {
    const before = snapshot.current;
    const id = accountRef.current?.id;
    setLedger(next);
    snapshot.current = next;
    if (!id) return;
    void (async () => {
      try {
        const db = await dbMod();
        await job(db, id);
      } catch (e) {
        setLedger(before);
        snapshot.current = before;
        setNotice(`Não foi possível salvar. ${humanError(e)}`);
      }
    })();
  }, []);

  /**
   * Mexe em um campo só da conta aberta, e só se ela ainda for a mesma.
   *
   * Duas coisas dependem disso. A primeira é que nome e foto são salvos
   * no mesmo clique, e escrever a conta inteira faria o segundo apagar o
   * primeiro. A segunda é que uma resposta que chega atrasada, depois de
   * trocar de conta, não pode encostar na conta nova.
   */
  const ajustarConta = useCallback((userId: string, patch: Partial<Account>) => {
    setAccount((atual) => {
      if (!atual || atual.id !== userId) return atual;
      const novo = { ...atual, ...patch };
      accountRef.current = novo;
      return novo;
    });
  }, []);

  const trocarFoto = useCallback(
    (userId: string, url: string | undefined) => ajustarConta(userId, { avatar: url }),
    [ajustarConta]
  );

  const trocarNome = useCallback(
    (userId: string, nome: string) => ajustarConta(userId, { name: nome }),
    [ajustarConta]
  );

  /**
   * Transforma o que está na coluna em imagem para a tela.
   *
   * Caminho do Storage vira URL assinada. Base64 antigo é migrado para o
   * Storage na primeira abertura, em silêncio: a pessoa não perde a foto e
   * a linha do perfil para de carregar a imagem inteira em toda leitura. Se
   * a migração falhar, nada quebra, a foto antiga continua na tela e a
   * tentativa se repete na próxima abertura.
   */
  const resolverAvatar = useCallback(
    async (userId: string, guardado: string | undefined) => {
      if (!guardado) return;
      try {
        const av = await avMod();
        if (av.ehLegado(guardado)) {
          const blob = av.legadoParaBlob(guardado);
          if (!blob) return;
          const caminho = await av.enviarAvatar(userId, blob);
          const db = await dbMod();
          await db.saveProfile(userId, { avatar: caminho });
          const url = await av.urlDoAvatar(caminho);
          if (url) trocarFoto(userId, url);
          return;
        }
        const url = await av.urlDoAvatar(guardado);
        trocarFoto(userId, url);
      } catch {
        /* foto é enfeite: nenhuma falha aqui pode atrapalhar o mês da pessoa */
      }
    },
    [trocarFoto]
  );

  /** Traz a carteira do servidor e completa as séries que faltam no mês. */
  const hydrate = useCallback(async (user: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: { nome?: string; exemplo?: boolean; full_name?: string; name?: string };
  }) => {
    /* O retrato é de outra pessoa: some com ele antes de buscar, senão
       os dados do dono anterior ficam na tela durante a consulta. */
    if (retrato && retrato.userId !== user.id) {
      apagarRetrato();
      setLedger(EMPTY);
      snapshot.current = EMPTY;
      setAccount(null);
      accountRef.current = null;
    }

    const db = await dbMod();
    const meta = user.user_metadata ?? {};
    /* Cadastro por e-mail guarda em `nome`; o Google devolve `full_name`. */
    const vindoDoCadastro = meta.nome || meta.full_name || meta.name || "";

    const { ledger: raw, profile, regras: aprendidas } = await db.loadLedger(
      user.id,
      vindoDoCadastro
    );
    setRegras(aprendidas);
    regrasRef.current = aprendidas;

    /* Primeira entrada de quem pediu dados de exemplo: a conta foi criada
       antes de existir sessão, então a carteira de demonstração só pode
       subir agora. A marca é apagada em seguida, para não voltar sozinha
       depois que a pessoa limpar tudo. */
    if (meta.exemplo && !raw.transactions.length && !raw.series.length) {
      const demo = materialize(demoLedger());
      await db.seedLedger(user.id, demo);
      const { supabase } = await sbMod();
      await supabase().auth.updateUser({ data: { exemplo: false } });
      raw.transactions = demo.transactions;
      raw.series = demo.series;
      raw.skips = demo.skips;
    }

    const grown = await repararCategorias(db, materialize(raw));
    const known = new Set(raw.transactions.map((t) => t.id));
    const fresh = grown.transactions.filter((t) => !known.has(t.id));
    if (fresh.length) {
      // o índice único no banco garante que duas abas não dupliquem
      await db.insertTransactions(user.id, fresh);
    }

    const acc: Account = {
      id: user.id,
      name: profile.name || (user.email ?? "").split("@")[0] || "Você",
      email: user.email ?? "",
      createdAt: (user.created_at ?? new Date().toISOString()).slice(0, 10),
      /* A coluna guarda o caminho no Storage, que não serve de src. Quem
         ainda tem o base64 antigo aparece na hora; os outros esperam a
         URL assinada, que chega logo abaixo sem segurar a abertura. */
      avatar: profile.avatar && profile.avatar.startsWith("data:") ? profile.avatar : undefined,
    };
    setAccount(acc);
    accountRef.current = acc;
    setLedger(grown);
    snapshot.current = grown;

    void resolverAvatar(user.id, profile.avatar);
  }, [resolverAvatar, retrato]);

  /* Guarda o retrato sempre que a carteira assenta. O atraso junta as
     rajadas de escrita, tipo importar um extrato inteiro, numa gravação
     só. Enquanto a sessão não foi checada não grava nada, senão uma
     carteira vazia sobrescreveria o retrato bom. */
  useEffect(() => {
    if (!ready || !account) return;
    const t = setTimeout(() => gravarRetrato(account.id, account, ledger), 600);
    return () => clearTimeout(t);
  }, [ready, account, ledger]);

  /* Só as rotas de conta precisam do Supabase. O site institucional
     usa o mesmo pacote, e checar a sessão nele faria a home baixar a
     biblioteca inteira à toa. Então a checagem espera a pessoa entrar
     em /entrar, /criar-conta ou /app. */
  /* A tela de nova senha entra nesta lista porque é ela que recebe o "?code="
     do link do e-mail: sem acordar o Supabase aqui, a troca do código pela
     sessão nunca acontece e a pessoa vê uma tela morta. */
  const needsSession = () =>
    /^#\/(app|entrar|criar-conta|nova-senha)/.test(window.location.hash);

  useEffect(() => {
    let alive = true;
    let booted = false;

    const boot = async () => {
      if (booted || !alive || !needsSession()) return;
      booted = true;

      const { hasSupabase, supabase } = await sbMod();
      if (!hasSupabase) {
        if (alive) setReady(true);
        return;
      }
      /* O ouvinte nasce ANTES do getSession, e isso não é estilo: a
         biblioteca enfileira as notificações disparadas durante a
         inicialização e só as descarrega quando ela termina. Registrando
         depois do getSession, o PASSWORD_RECOVERY já teria passado e a
         marca de recuperação nunca seria ligada. */
      supabase().auth.onAuthStateChange((event) => {
        if (!alive) return;
        /* Único lugar que liga a marca. Chega da própria biblioteca, depois
           da troca do código do link pela sessão. */
        if (event === "PASSWORD_RECOVERY") {
          marcarRecuperacao(true);
          if (!/^#\/nova-senha/.test(window.location.hash)) {
            window.location.hash = "#/nova-senha";
          }
          return;
        }
        if (event === "SIGNED_OUT") {
          apagarRetrato();
          setRegras([]);
          regrasRef.current = [];
          marcarRecuperacao(false);
          setAccount(null);
          accountRef.current = null;
          setLedger(EMPTY);
          snapshot.current = EMPTY;
        }
      });

      try {
        const { data } = await supabase().auth.getSession();
        if (alive && data.session?.user) await hydrate(data.session.user);
      } catch (e) {
        if (alive) setNotice(humanError(e));
      }
      if (alive) setReady(true);
    };

    void boot();
    window.addEventListener("hashchange", boot);
    return () => {
      alive = false;
      window.removeEventListener("hashchange", boot);
    };
  }, [hydrate, marcarRecuperacao]);

  const value = useMemo<Store>(() => {
    const commit = (next: Ledger, job: (db: Db, userId: string) => Promise<void>) =>
      write(
        {
          ...next,
          transactions: [...next.transactions].sort((a, b) => b.date.localeCompare(a.date)),
        },
        job
      );

    return {
      ready,
      account,
      ledger,
      regras,
      transactions: ledger.transactions,
      categories: ledger.categories,
      home: ledger.home,
      theme: ledger.theme,
      calc: ledger.calc,
      calcOpen,
      calcTape,
      notice,
      showNotice: (texto: string) => setNotice(texto),
      dismissNotice: () => setNotice(null),
      setCalcOpen,
      setCalcTape,

      setTheme(v) {
        commit({ ...ledger, theme: v }, (db, id) => db.saveProfile(id, { theme: v }));
      },

      setCalc(v) {
        if (!v) {
          setCalcOpen(false);
          setCalcTape(EMPTY_TAPE);
        }
        commit({ ...ledger, calc: v }, (db, id) => db.saveProfile(id, { calc: v }));
      },

      async signUp(name, email, password, withDemo) {
        const mail = email.trim().toLowerCase();
        try {
          const { supabase, hasSupabase, MISSING_ENV } = await sbMod();
          if (!hasSupabase) return { ok: false, error: MISSING_ENV };

          const clean = name.trim() || mail.split("@")[0];

          /* O nome e a escolha de dados de exemplo vão no próprio usuário
             porque, com confirmação de e-mail ligada, o cadastro não devolve
             sessão: a pessoa só volta depois de clicar no link, e sem isso as
             duas escolhas dela se perderiam no caminho. */
          const { data, error } = await supabase().auth.signUp({
            email: mail,
            password,
            options: {
              data: { nome: clean, exemplo: withDemo },
              emailRedirectTo: `${window.location.origin}${window.location.pathname}#/entrar`,
            },
          });
          if (error) {
            /* E-mail já cadastrado: em vez de dizer isso, que entregaria a um
               estranho quem tem conta aqui, seguimos o mesmo caminho de quem
               acabou de se cadastrar. É exatamente o que o Supabase já faz
               sozinho quando o e-mail está confirmado, então as duas
               situações ficam indistinguíveis de fora. */
            const msg = String((error as { message?: string }).message ?? "").toLowerCase();
            if (msg.includes("already registered") || msg.includes("already been registered")) {
              return { ok: false, confirm: true, error: "Confirme seu e-mail para entrar." };
            }
            return { ok: false, error: humanError(error) };
          }
          if (!data.user) return { ok: false, error: "Não foi possível criar a conta." };
          if (!data.session) {
            return {
              ok: false,
              confirm: true,
              error: "Confirme seu e-mail para entrar.",
            };
          }

          const db = await dbMod();
          await db.ensureProfile(data.user.id, clean);
          await db.saveProfile(data.user.id, { name: clean });

          const start = withDemo ? materialize(demoLedger()) : EMPTY;
          if (withDemo) await db.seedLedger(data.user.id, start);

          const acc: Account = {
            id: data.user.id,
            name: clean,
            email: mail,
            createdAt: new Date().toISOString().slice(0, 10),
          };
          setAccount(acc);
          accountRef.current = acc;
          setLedger(start);
          snapshot.current = start;
          return { ok: true };
        } catch (e) {
          return { ok: false, error: humanError(e) };
        }
      },

      async signIn(email, password) {
        const mail = email.trim().toLowerCase();
        try {
          const { supabase, hasSupabase, MISSING_ENV } = await sbMod();
          if (!hasSupabase) return { ok: false, error: MISSING_ENV };

          const { data, error } = await supabase().auth.signInWithPassword({
            email: mail,
            password,
          });
          if (error) return { ok: false, error: humanError(error) };
          if (!data.user) return { ok: false, error: "E-mail ou senha incorretos." };

          await hydrate(data.user);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: humanError(e) };
        }
      },

      async resendConfirmation(email) {
        try {
          const { supabase, hasSupabase, MISSING_ENV } = await sbMod();
          if (!hasSupabase) return { ok: false, error: MISSING_ENV };
          const { error } = await supabase().auth.resend({
            type: "signup",
            email: email.trim().toLowerCase(),
            options: {
              emailRedirectTo: `${window.location.origin}${window.location.pathname}#/entrar`,
            },
          });
          if (error) return { ok: false, error: humanError(error) };
          return { ok: true };
        } catch (e) {
          return { ok: false, error: humanError(e) };
        }
      },

      async signInWithGoogle() {
        try {
          const { supabase, hasSupabase, MISSING_ENV } = await sbMod();
          if (!hasSupabase) return { ok: false, error: MISSING_ENV };
          const { error } = await supabase().auth.signInWithOAuth({
            provider: "google",
            options: {
              /* O roteador usa "#", e o PKCE volta em "?code=", que não
                 colide com ele. A volta cai em /entrar, que redireciona
                 para /app assim que a sessão existe. */
              redirectTo: `${window.location.origin}${window.location.pathname}#/entrar`,
            },
          });
          if (error) return { ok: false, error: humanError(error) };
          return { ok: true };
        } catch (e) {
          return { ok: false, error: humanError(e) };
        }
      },

      async pedirNovaSenha(email) {
        const mail = email.trim().toLowerCase();
        try {
          const { supabase, hasSupabase, MISSING_ENV } = await sbMod();
          if (!hasSupabase) return { ok: false, error: MISSING_ENV };
          /* A volta cai em #/nova-senha. O "?code=" do PKCE entra antes do "#",
             então ele não briga com o roteador. */
          await supabase().auth.resetPasswordForEmail(mail, {
            redirectTo: `${window.location.origin}${window.location.pathname}#/nova-senha`,
          });
          /* Nem o erro é devolvido: responder diferente quando o e-mail não
             existe entregaria a informação que a gente quer esconder. */
          return { ok: true };
        } catch {
          return { ok: true };
        }
      },

      async definirSenha(senha) {
        /* Primeira barreira, e é só de interface: sem a marca, esta tela não
           é o caminho. Quem troca senha estando logado normalmente usa o
           fluxo de ajustes, que pede a senha atual. */
        if (!recuperacaoRef.current) {
          return {
            ok: false,
            error:
              "Esta tela só funciona para quem chegou pelo link de recuperação. Peça um link novo em Entrar.",
          };
        }
        try {
          const { supabase, hasSupabase, MISSING_ENV } = await sbMod();
          if (!hasSupabase) return { ok: false, error: MISSING_ENV };
          const { data } = await supabase().auth.getSession();
          if (!data.session) {
            return {
              ok: false,
              error:
                "Este link não abriu uma sessão. Ele precisa ser aberto no mesmo aparelho e navegador onde você pediu a troca. Peça um link novo e tente de novo.",
            };
          }
          const { error } = await supabase().auth.updateUser({ password: senha });
          if (error) return { ok: false, error: humanError(error) };
          // a marca vale uma troca só
          marcarRecuperacao(false);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: humanError(e) };
        }
      },

      async apagarConta() {
        try {
          const { supabase, hasSupabase } = await sbMod();
          if (!hasSupabase) return { ok: false, error: "Sem conexão com o servidor." };
          const { error } = await supabase().rpc("apagar_minha_conta");
          if (error) {
            /* A função é criada por migração à parte. Se o site subir antes
               dela, o erro precisa dizer isso, e não "algo deu errado". */
            const faltando =
              /function .*apagar_minha_conta.* does not exist/i.test(error.message) ||
              error.code === "PGRST202";
            return {
              ok: false,
              error: faltando
                ? "A rotina de exclusão ainda não foi instalada no servidor. Fale com o suporte."
                : humanError(error),
            };
          }
          /* A sessão morreu junto com o usuário: o signOut aqui é só para
             limpar o que ficou nesta aba. */
          this.signOut();
          return { ok: true };
        } catch (e) {
          return { ok: false, error: humanError(e) };
        }
      },

      signOut() {
        apagarRetrato();
        setAccount(null);
        accountRef.current = null;
        setRegras([]);
        regrasRef.current = [];
        setLedger(EMPTY);
        snapshot.current = EMPTY;
        setCalcOpen(false);
        setCalcTape(EMPTY_TAPE);
        setNotice(null);
        void (async () => {
          try {
            const { supabase, hasSupabase } = await sbMod();
            if (hasSupabase) await supabase().auth.signOut();
          } catch {
            /* a sessão local já foi encerrada; o resto é limpeza */
          }
        })();
      },

      setAvatar(foto) {
        /* undefined é "não mexeram na foto": salvar o perfil só para trocar
           o nome não pode reenviar imagem nem apagar a que já está lá. */
        if (!account || foto === undefined) return;
        const dono = account.id;
        const fotoAnterior = account.avatar;
        /* A prévia local aparece na hora, antes de o arquivo subir. */
        const previa = foto ? URL.createObjectURL(foto) : undefined;
        /* Só a foto muda aqui. O nome é salvo pelo setName, que roda no
           mesmo clique: partir do `account` capturado desfaria o nome novo. */
        trocarFoto(dono, previa);
        void (async () => {
          let trocou = false;
          try {
            const av = await avMod();
            const db = await dbMod();
            if (foto) {
              const caminho = await av.enviarAvatar(dono, foto);
              await db.saveProfile(dono, { avatar: caminho });
              const url = await av.urlDoAvatar(caminho);
              /* Sem URL assinada a prévia continua valendo até recarregar:
                 o arquivo está salvo, só a assinatura é que não veio. */
              if (url) {
                trocarFoto(dono, url);
                trocou = true;
              }
            } else {
              /* A coluna é limpa primeiro. Se a ordem fosse ao contrário e a
                 gravação falhasse, a linha apontaria para um arquivo que já
                 não existe, e a foto sumiria sem aviso na próxima abertura.
                 Arquivo sobrando é inofensivo; caminho apontando para o vazio
                 não é. */
              await db.saveProfile(dono, { avatar: undefined });
              await av.apagarAvatar(dono);
              trocou = true;
            }
          } catch (e) {
            trocarFoto(dono, fotoAnterior);
            setNotice(`Não foi possível salvar a foto. ${humanError(e)}`);
            trocou = true;
          } finally {
            /* O endereço temporário só é devolvido quando a tela já saiu
               dele, senão a foto vira um quadrado vazio. */
            if (previa && trocou) setTimeout(() => URL.revokeObjectURL(previa), 10_000);
          }
        })();
      },

      setName(name) {
        if (!account || !name.trim()) return;
        const dono = account.id;
        const nomeAnterior = account.name;
        const clean = name.trim();
        /* Nome e foto são salvos no mesmo clique. Cada um mexe só no seu
           campo, senão o segundo desfaz o primeiro. */
        trocarNome(dono, clean);
        void (async () => {
          try {
            const db = await dbMod();
            await db.saveProfile(dono, { name: clean });
          } catch (e) {
            trocarNome(dono, nomeAnterior);
            setNotice(`Não foi possível salvar o nome. ${humanError(e)}`);
          }
        })();
      },

      add(entry) {
        if (entry.repeat === "none") {
          const tx: Transaction = {
            id: uid(),
            description: entry.description,
            amount: entry.amount,
            kind: entry.kind,
            category: entry.category,
            date: entry.date,
            recurrence: entry.recurrence,
          };
          commit({ ...ledger, transactions: [tx, ...ledger.transactions] }, (db, id) =>
            db.insertTransactions(id, [tx])
          );
          return;
        }

        const { series, skips } = buildSeries({
          ...entry,
          mode: entry.repeat,
          total: entry.installments,
        });
        /* Os pulos entram antes do materialize: eles são justamente o
           que impede as parcelas já pagas de nascerem para trás quando
           a compra começa no meio, tipo "5 de 6". */
        const comSkips = {
          ...ledger,
          series: [...ledger.series, series],
          skips: skips.length ? [...ledger.skips, ...skips] : ledger.skips,
        };
        const next = materialize(comSkips);
        const known = new Set(ledger.transactions.map((t) => t.id));
        const fresh = next.transactions.filter((t) => !known.has(t.id));
        commit(next, async (db, id) => {
          await db.insertSeries(id, series);
          if (skips.length) await db.addSkips(id, skips);
          await db.insertTransactions(id, fresh);
        });
      },

      addMany(rows) {
        const made = rows.map((r) => ({ ...r, id: uid() }));
        commit({ ...ledger, transactions: [...made, ...ledger.transactions] }, (db, id) =>
          db.insertTransactions(id, made)
        );
      },

      importar(rows, novasCategorias, virarMovimentacao, novasRegras) {
        const made = rows.map((r) => ({ ...r, id: uid() }));
        const viram = new Set(virarMovimentacao);
        const categorias = [...ledger.categories];
        for (const c of novasCategorias) {
          if (!categorias.some((x) => x.id === c.id)) categorias.push(c);
        }
        commit(
          {
            ...ledger,
            categories: categorias,
            transactions: [
              ...made,
              ...ledger.transactions.map((t) =>
                viram.has(t.id) ? { ...t, kind: "movimentacao" as const } : t
              ),
            ],
          },
          async (db, userId) => {
            for (const c of novasCategorias) await db.saveCategory(userId, c);
            for (const id of virarMovimentacao) {
              await db.updateTransaction(id, { kind: "movimentacao" });
            }
            await db.insertTransactions(userId, made);
            /* A memória é um bônus, e o extrato é o que importa. Se a
               gravação da regra falhar, a importação continua valendo:
               desfazer lançamentos já inseridos por causa disso seria
               trocar um problema pequeno por um grande. */
            try {
              await db.saveRules(userId, novasRegras);
              if (novasRegras.length) {
                const juntas = fundir(regrasRef.current, novasRegras);
                regrasRef.current = juntas;
                setRegras(juntas);
              }
            } catch {
              /* fica sem memória desta vez; a próxima correção ensina de novo */
            }
          }
        );
      },

      update(id, patch) {
        /* Consertar um lançamento é a forma mais natural de ensinar: quem
           diz uma vez que aquele Pix é farmácia não deveria precisar dizer
           de novo no mês que vem. */
        const antes = ledger.transactions.find((t) => t.id === id);
        const aprendida =
          antes && !antes.seriesId
            ? aprenderDaEdicao(antes, patch, new Date().toISOString())
            : null;

        commit(
          {
            ...ledger,
            transactions: ledger.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          },
          async (db, userId) => {
            await db.updateTransaction(id, patch);
            if (!aprendida) return;
            /* Só entra na memória o que o servidor aceitou: regra que
               vive só na tela enganaria a próxima importação. */
            try {
              await db.saveRules(userId, [aprendida]);
              const juntas = fundir(regrasRef.current, [aprendida]);
              regrasRef.current = juntas;
              setRegras(juntas);
            } catch {
              /* a correção do lançamento vale; a lição fica para a próxima */
            }
          }
        );
      },

      remove(id) {
        const tx = ledger.transactions.find((t) => t.id === id);
        const key = tx ? skipKey(tx) : null;
        commit(
          {
            ...ledger,
            transactions: ledger.transactions.filter((t) => t.id !== id),
            skips: key ? [...new Set([...ledger.skips, key])] : ledger.skips,
          },
          async (db, userId) => {
            await db.deleteTransactions([id]);
            if (key) await db.addSkips(userId, [key]);
          }
        );
      },

      removeSeries(seriesId) {
        commit(
          {
            ...ledger,
            transactions: ledger.transactions.filter((t) => t.seriesId !== seriesId),
            series: ledger.series.filter((s) => s.id !== seriesId),
            skips: ledger.skips.filter((k) => !k.startsWith(`${seriesId}@`)),
          },
          (db) => db.deleteSeries(seriesId)
        );
      },

      removeMonth(ym) {
        const doomed = ledger.transactions.filter((t) => t.date.startsWith(ym));
        const ids = doomed.map((t) => t.id);
        const keys = doomed.map(skipKey).filter(Boolean) as string[];
        commit(
          {
            ...ledger,
            transactions: ledger.transactions.filter((t) => !t.date.startsWith(ym)),
            skips: [...new Set([...ledger.skips, ...keys])],
          },
          async (db, userId) => {
            await db.deleteTransactions(ids);
            if (keys.length) await db.addSkips(userId, keys);
          }
        );
      },

      saveCategory(cat) {
        const id = cat.id || slugify(cat.label);
        const exists = ledger.categories.some((c) => c.id === id);
        const next: Category = { ...cat, id };
        commit(
          {
            ...ledger,
            categories: exists
              ? ledger.categories.map((c) => (c.id === id ? { ...c, ...next } : c))
              : [...ledger.categories, next],
          },
          (db, userId) => db.saveCategory(userId, next)
        );
        return id;
      },

      removeCategory(id) {
        /* As categorias que vêm prontas são só um ponto de partida: quem
           não usa "Academia" pode tirar da frente. A única que se protege
           é "Outros", porque é para onde vai o que sobra de uma categoria
           apagada; sem ela o lançamento ficaria sem destino. */
        const cat = ledger.categories.find((c) => c.id === id);
        if (!cat || id === "outros") return;
        const fallback = "outros";
        commit(
          {
            ...ledger,
            categories: ledger.categories.filter((c) => c.id !== id),
            transactions: ledger.transactions.map((t) =>
              t.category === id ? { ...t, category: fallback } : t
            ),
            series: ledger.series.map((s) =>
              s.template.category === id
                ? { ...s, template: { ...s.template, category: fallback } }
                : s
            ),
          },
          (db, userId) => db.removeCategory(userId, id, fallback)
        );
      },

      restoreBaseCategories() {
        const tem = new Set(ledger.categories.map((c) => c.id));
        const faltando = BASE_CATEGORIES.filter((c) => !tem.has(c.id));
        if (!faltando.length) return;
        commit({ ...ledger, categories: [...ledger.categories, ...faltando] }, async (db, userId) => {
          for (const c of faltando) await db.saveCategory(userId, c);
        });
      },

      setHome(ids) {
        commit({ ...ledger, home: ids }, (db, userId) => db.saveProfile(userId, { home: ids }));
      },

      clearAll() {
        commit(
          {
            ...EMPTY,
            categories: ledger.categories,
            home: ledger.home,
            theme: ledger.theme,
            calc: ledger.calc,
          },
          (db, userId) => db.wipeLedger(userId)
        );
      },

      recuperacao,

      loadDemo() {
        const next = materialize(demoLedger());
        commit({ ...next, home: ledger.home, theme: ledger.theme, calc: ledger.calc }, async (db, userId) => {
          await db.wipeLedger(userId);
          await db.seedLedger(userId, next);
        });
      },
    };
  }, [ready, account, ledger, calcOpen, calcTape, notice, recuperacao, marcarRecuperacao, write, hydrate, trocarFoto, trocarNome, regras]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore precisa estar dentro de <StoreProvider>");
  return v;
}
