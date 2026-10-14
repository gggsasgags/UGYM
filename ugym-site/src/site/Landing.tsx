import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon";
import { LogoMark } from "../components/Logo";
import { Phone } from "../components/Phone";
import { LockScreen, PhoneApp } from "./PhoneApp";
import areiaSrc from "../assets/areia.jpg";
import { BASE_CATEGORIES } from "../lib/categories";
import { demoLedger } from "../lib/demo";
import { materialize } from "../lib/series";
import { monthReport } from "../lib/analytics";
import { SHOWCASE_TX, SHOWCASE_YM } from "../lib/showcase";
import { monthLabel, todayYM } from "../lib/format";
import { PASSOS_INSTALAR } from "../lib/instalar";
import { HERO_FLOOR, HERO_GASTOS, HERO_RECEITAS, HERO_TOTAL, HERO_YM } from "./heroMonth";
import "./landing.css";

const LEDGER = materialize(demoLedger());
const TX = LEDGER.transactions;
const CATS = LEDGER.categories;
const YM = todayYM();
/* A seção "Nota do mês" usa um mês de exemplo próprio, não os dados de
   demonstração do aplicativo. Ele passa pelo mesmo motor de cálculo, então o
   número no círculo, a faixa e os três pilares saem todos da mesma conta e
   não podem se contradizer. */
const SCORE = monthReport(SHOWCASE_TX, SHOWCASE_YM, CATS);

/* ------------------------------------------------------------------
   Efeitos do scrolltelling.

   Cada um tem a sua chave porque foram feitos para serem julgados
   vendo, não imaginando. Desligar um é trocar true por false aqui, sem
   mexer em mais nada no arquivo.

   Todos são transform e opacity, que a placa de vídeo resolve sozinha,
   e todos somem quando o sistema pede menos movimento.
-------------------------------------------------------------------*/
const EFEITOS = {
  /** 1 · o indicador das abas desliza junto com o capítulo */
  abaViaja: true,
  /** 2 · uma faixa de luz verde cruza o vidro no instante da troca */
  passadaDeLuz: false,
  /** 4 · o halo verde sobre a areia muda de lugar a cada capítulo */
  haloMuda: false,
  /** 6 · fio vertical com um trecho verde que desce conforme avança */
  trilho: true,
  /** a areia anda mais devagar que a página */
  parallax: true,
};

/* A moldura do componente Phone tem 383x785, então a largura sai da
   altura da cena. Nada aqui é foto: o aparelho é vetor e a tela é o app. */
const FRAME_RATIO = 383 / 785;

const DEMO_ACCOUNT = { id: "demo", name: "Diego", email: "diego@exemplo.com", salt: "", hash: "", createdAt: "" };

/* Só o e-mail. O telefone daqui era o pessoal do Diego, e número escrito
   em página aberta é colhido por robô e não sai mais da internet. Quando
   existir uma linha só do Gastô, ela volta para cá. */
const CONTATO = {
  email: "contatogasto@gmail.com",
};

/* Os quatro passos da seção do aplicativo. O texto é curto de propósito:
   quem lê está olhando para a tela do celular ao lado, não para o texto. */
const CHAPTERS: { tag: string; resumo: string; tab: string }[] = [
  {
    tag: "Início",
    resumo: "O total gasto no mês, grande, antes de qualquer outra coisa.",
    tab: "inicio",
  },
  {
    tag: "Lançamentos",
    resumo: "Cada gasto do mês, com busca, filtro e importação de extrato.",
    tab: "lancamentos",
  },
  {
    tag: "Resumo",
    resumo: "Os meses lado a lado, para ver o que é hábito e o que foi exceção.",
    tab: "resumo",
  },
  {
    tag: "Análises",
    resumo: "A nota do mês, com as três contas que a formaram, sem opinião.",
    tab: "analises",
  },
];

/* Peso da primeira fatia da rolagem, em que o aparelho ainda está
   bloqueado. Menor que 1 porque abrir o app é o prólogo, não um capítulo.
   O fecho é a sobra do fim, para o último passo ficar um tempo na tela em
   vez de acender no instante em que o quadro já está indo embora. */
const ABERTURA = 0.55;
const FECHO = 0.6;

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "assinaturas",
    title: "Fixo e variável desde o início",
    text:
      "Todo lançamento nasce classificado. É o que permite separar o que você escolhe gastar do que já está comprometido.",
  },
  {
    icon: "calendar",
    title: "Parcelas com contagem",
    text:
      "Registre uma vez como 1/10 e o Gastô mostra em qual parcela você está em cada mês seguinte.",
  },
  {
    icon: "sheet",
    title: "Modo planilha",
    text:
      "Quem veio do Excel não precisa abrir mão da tabela. O mesmo dado, em linhas e colunas.",
  },
  {
    icon: "search",
    title: "Busca que entende data",
    text:
      "Procure por “27/04”, por “165,01” ou por “combustível”. O campo aceita os três.",
  },
  {
    icon: "resumo",
    title: "Médias que dizem algo",
    text:
      "As médias ignoram meses sem dados, então um mês vazio não distorce a leitura do período.",
  },
  {
    icon: "shield",
    title: "Sua conta, só sua",
    text:
      "Cada conta enxerga apenas os próprios lançamentos, e o Gastô nunca pede acesso ao seu banco. Você registra o que quiser registrar.",
  },
];


const FAQ: { q: string; a: string }[] = [
  {
    q: "Quanto custa?",
    a: "Hoje, nada. O Gastô é gratuito enquanto estiver crescendo. Em algum momento vai existir uma versão paga, e quando isso acontecer será avisado com antecedência, sem tirar o que você já registrou.",
  },
  {
    q: "Preciso conectar minha conta do banco?",
    a: "Não, e o Gastô nem pede isso. Você registra na mão, que leva segundos, ou importa o extrato que o próprio banco te entrega em PDF, Excel ou CSV. Sua senha do banco não passa por aqui.",
  },
  {
    q: "Serve para minha empresa?",
    a: "Não. O Gastô foi feito para pessoa física, com contas de pessoa física. Fluxo de caixa de empresa, nota fiscal e centro de custo ficam de fora de propósito, porque é isso que mantém o app simples.",
  },
  {
    q: "Por que não mostra meu saldo?",
    a: "Porque saldo engana. Ele muda por motivos que não dependem de você e faz um mês descontrolado parecer tranquilo só porque o salário acabou de cair. O Gastô olha para o gasto, que é a parte que está na sua mão.",
  },
  {
    q: "Funciona no celular?",
    a: "Funciona, e é onde ele foi pensado para ser usado, em pé na fila do mercado. Dá para adicionar o Gastô à tela inicial do celular e abrir como qualquer outro aplicativo.",
  },
  {
    q: "Já usei planilha e desisti. Vai ser diferente?",
    a: "A planilha cobra duas coisas: abrir um arquivo e manter fórmula. O Gastô cobra só o lançamento, e devolve leitura pronta, nota do mês e comparação entre meses sem você montar nada.",
  },
];

/* ---------- rastro verde que segue o cursor em faixas escuras ---------- */

function useGlow<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
        el.style.setProperty("--glow", "1");
      });
    };
    const leave = () => el.style.setProperty("--glow", "0");
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}


/* ------------------------------------------------------------------
   O mês do celular do topo acontece na mão do visitante.

   Ao abrir, o mês está só começando: R$ 500 e poucos dias marcados.
   Mexer o mouse sobre a faixa escura faz o mês avançar, e quanto mais
   rápido o movimento, mais rápido ele anda, até um teto. Como é o app
   de verdade recebendo lançamentos de verdade em ordem de data, o
   total, a contagem, o calendário e as barras de categoria crescem
   todos pela mesma causa.

   Em aparelho sem mouse não há o que mexer, então lá o mês roda
   sozinho, com a curva calma de sempre.
-------------------------------------------------------------------*/
/** duração do preenchimento automático em aparelho de toque */
const HERO_AUTO_MS = 7600;
/** respiro antes de começar, para o olho pousar no número parado primeiro */
const HERO_AUTO_ESPERA = 700;
/** distância de mouse, em pixels, para encher o mês inteiro */
const HERO_PIXELS = 8000;
/** teto de avanço por quadro, para um movimento brusco não estourar */
const HERO_MAX_PASSO = 0.0035;
/** o quanto o valor mostrado persegue o alvo a cada quadro */
const HERO_SUAVIDADE = 0.09;

function useHeroFill() {
  const areaRef = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  const [mexeu, setMexeu] = useState(false);

  const alvo = useRef(0);
  const atual = useRef(0);
  const ultimo = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const semMouse = window.matchMedia("(hover: none)").matches;
    const menosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;

    /* Quem pediu menos movimento vê o mês já cheio, sem animação. */
    if (menosMovimento) {
      setP(1);
      setMexeu(true);
      return;
    }

    /* Sem mouse não há o que mexer, então o mês roda sozinho. É bem mais
       devagar que no computador: no celular o número ocupa a tela inteira
       e subir rápido fica agressivo. */
    if (semMouse) {
      const t0 = performance.now() + HERO_AUTO_ESPERA;
      const tick = (t: number) => {
        const bruto = Math.min(1, Math.max(0, (t - t0) / HERO_AUTO_MS));
        setP(1 - Math.pow(1 - bruto, 2.6));
        if (bruto < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      setMexeu(true);
      return () => cancelAnimationFrame(raf);
    }

    const el = areaRef.current;
    if (!el) return;

    const mover = (e: PointerEvent) => {
      const antes = ultimo.current;
      ultimo.current = { x: e.clientX, y: e.clientY };
      if (!antes) return;
      const d = Math.hypot(e.clientX - antes.x, e.clientY - antes.y);
      if (d < 0.5) return;
      setMexeu(true);
      alvo.current = Math.min(
        1,
        alvo.current + Math.min(d / HERO_PIXELS, HERO_MAX_PASSO)
      );
    };
    const sair = () => {
      ultimo.current = null;
    };

    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerleave", sair);

    /* O valor mostrado persegue o alvo, então movimento picotado vira
       crescimento contínuo em vez de solavanco. */
    const seguir = () => {
      raf = requestAnimationFrame(seguir);
      const delta = alvo.current - atual.current;
      if (Math.abs(delta) < 0.0002) return;
      atual.current += delta * HERO_SUAVIDADE;
      setP(atual.current);
    };
    raf = requestAnimationFrame(seguir);

    return () => {
      el.removeEventListener("pointermove", mover);
      el.removeEventListener("pointerleave", sair);
      cancelAnimationFrame(raf);
    };
  }, []);

  const totalShown = HERO_FLOOR + (HERO_TOTAL - HERO_FLOOR) * p;

  /* Quantos lançamentos já entraram: o primeiro dia aparece de cara,
     para o calendário nunca começar totalmente apagado. */
  const n = useMemo(() => {
    let alvoValor = totalShown;
    let soma = 0;
    let i = 0;
    while (i < HERO_GASTOS.length && soma + HERO_GASTOS[i].amount <= alvoValor) {
      soma += HERO_GASTOS[i].amount;
      i++;
    }
    return Math.max(1, i);
  }, [totalShown]);

  const tx = useMemo(() => [...HERO_RECEITAS, ...HERO_GASTOS.slice(0, n)], [n]);

  return { areaRef, tx, totalShown, mexeu };
}

/* --------------------------- página --------------------------- */

export default function Landing() {
  const hero = useHeroFill();
  /* -1 é a tela bloqueada; 0 a 3 são os quatro passos */
  const [passo, setPasso] = useState(-1);
  const [wide, setWide] = useState(true);
  const [alturaTela, setAlturaTela] = useState(900);
  /* deslocamento da areia, em pixels, para ela andar mais devagar que a página */
  const [deriva, setDeriva] = useState(0);
  const palcoRef = useRef<HTMLDivElement>(null);
  const areiaRef = useRef<HTMLElement>(null);

  const heroRef = useGlow<HTMLElement>();
  const navRef = useGlow<HTMLElement>();
  const scoreRef = useGlow<HTMLElement>();
  const closeRef = useGlow<HTMLElement>();
  const footRef = useGlow<HTMLElement>();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 940px)");
    const sync = () => {
      setWide(mq.matches);
      setAlturaTela(window.innerHeight);
    };
    sync();
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  /* O passo sai da posição da rolagem dentro do trilho da seção, e não de
     um observador por capítulo: aqui o quadro inteiro fica preso na tela e
     é só o conteúdo dele que troca, então o que importa é o quanto do
     trilho já passou. A primeira fatia, menor, é a tela bloqueada. */
  useEffect(() => {
    const el = palcoRef.current;
    if (!el) return;
    let raf = 0;
    const ler = () => {
      const r = el.getBoundingClientRect();
      const curso = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / curso));
      const pos = p * (ABERTURA + CHAPTERS.length + FECHO) - ABERTURA;
      setPasso(pos < 0 ? -1 : Math.min(CHAPTERS.length - 1, Math.floor(pos)));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(ler);
    };
    ler();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* Clicar em um passo leva a rolagem até o meio da fatia dele, porque a
     lista também serve de índice e não só de legenda. */
  const irPara = (i: number) => {
    const el = palcoRef.current;
    if (!el) return;
    const curso = el.offsetHeight - window.innerHeight;
    const topo = el.getBoundingClientRect().top + window.scrollY;
    const fatia = (ABERTURA + i + 0.5) / (ABERTURA + CHAPTERS.length + FECHO);
    window.scrollTo({ top: Math.round(topo + curso * fatia), behavior: "smooth" });
  };

  /* A areia anda um pouco mais devagar que a página. O deslocamento é
     pequeno de propósito: dá profundidade sem ninguém reparar no truque. */
  useEffect(() => {
    if (!EFEITOS.parallax) return;
    const el = areiaRef.current;
    if (!el) return;
    let raf = 0;
    const read = () => {
      const r = el.getBoundingClientRect();
      const meio = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
      setDeriva(Math.round(Math.max(-1, Math.min(1, meio)) * -34));
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* O quadro inteiro cabe numa tela só, então o aparelho é medido pela
     altura visível: o que sobra depois do título e da lista de passos. */
  const sceneH = wide
    ? Math.round(Math.min(580, Math.max(330, alturaTela - 400)))
    : Math.round(Math.min(420, Math.max(250, alturaTela * 0.4)));

  // o aparelho ocupa a altura da cena, e a largura sai da proporção da moldura
  const phoneW = Math.round(sceneH * FRAME_RATIO);

  // antes do primeiro passo o aparelho ainda está bloqueado
  const opened = passo >= 0;
  const active = Math.max(0, passo);

  return (
    <div className="site">
      <header className="nav glowable" ref={navRef}>
        <span className="glow" aria-hidden="true" />
        <div className="wrap nav__in">
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <LogoMark size={24} ink="#fff" />
            <span
              style={{
                fontFamily: "var(--f-display)",
                fontWeight: 600,
                fontSize: 19,
                letterSpacing: "-0.035em",
              }}
            >
              Gastô
            </span>
          </Link>

          <nav className="nav__links">
            <a href="#produto">Como funciona</a>
            <a href="#nota">Nota do mês</a>
            <a href="#recursos">Recursos</a>
            <a href="#origem">Quem fez</a>
            <a href="#contato">Contato</a>
          </nav>

          <div className="nav__cta">
            <Link to="/entrar" className="nav__login">
              Entrar
            </Link>
            <Link to="/criar-conta" className="btn btn--acid btn--sm">
              Começar agora
            </Link>
          </div>
        </div>
      </header>

      {/* ---------------- herói ---------------- */}
      <section
        className="hero-s glowable"
        ref={(el) => {
          (heroRef as { current: HTMLElement | null }).current = el;
          (hero.areaRef as { current: HTMLElement | null }).current = el;
        }}
      >
        <span className="hero-s__bg" aria-hidden="true" />
        <span className="glow" aria-hidden="true" />
        <div className="wrap hero-s__grid">
          <div className="hero-s__copy">
            <span className="eyebrow mono">Controle de gastos pessoais</span>
            <h1>
              O segredo não está em quanto você ganha. Está em quanto você{" "}
              <em>gasta</em>.
            </h1>
            <p className="hero-s__sub">
              Ninguém ensinou a gente a cuidar de dinheiro, nem na escola nem depois
              dela. O Gastô mostra para onde o seu está indo, separa o que é
              compromisso do que foi escolha, e fecha o mês com uma nota que explica
              o próprio resultado.
            </p>

            <div className="hero-s__acts">
              <Link to="/criar-conta" className="btn btn--acid">
                Entrar no Gastô
                <Icon name="arrowUpRight" size={17} />
              </Link>
              <a href="#produto" className="btn btn--ghost">
                Ver como funciona
              </a>
            </div>

            <div className="hero-s__fine">
              <span><i />Comece grátis</span>
              <span><i />Sem cartão de crédito</span>
              <span><i />Já abre com dados de exemplo</span>
            </div>
          </div>

          <div className="hero-s__stage">
            <Phone width={278} glow className="hero-s__phone">
              <PhoneApp
                tab="inicio"
                tx={hero.tx}
                ym={HERO_YM}
                totalShown={hero.totalShown}
                cats={CATS}
                account={DEMO_ACCOUNT}
                home={LEDGER.home}
              />
            </Phone>
            {!hero.mexeu && (
              <span className="hero-s__dica" aria-hidden="true">
                mexa o mouse aqui para o mês acontecer
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ---------------- fatos ---------------- */}
      <section className="facts on-ink">
        <div className="wrap facts__in">
          <div className="fact rise">
            <div className="fact__k">Fixo · Variável</div>
            <p className="fact__v">
              A única divisão que muda como você decide gastar no mês seguinte.
            </p>
          </div>
          <div className="fact rise">
            <div className="fact__k num">0 a 10</div>
            <p className="fact__v">
              Uma nota mensal que vem acompanhada da explicação, nunca sozinha.
            </p>
          </div>
          <div className="fact rise">
            <div className="fact__k">Pessoa física</div>
            <p className="fact__v">
              Feito para gente com contas normais, não para empresa nem para
              investidor profissional.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- narrativa ---------------- */}
      <section className="sec sec--areia" id="produto" ref={areiaRef}>
        {/* A textura sangra a seção inteira e leva véu por cima, senão a foto
            entra como corpo estranho em vez de virar parte da marca.

            O palco fica preso à tela enquanto a seção rola. Sem isso a foto
            seria esticada para a altura inteira da seção, que é altíssima, e
            o grão da areia viraria chiado. */}
        <div className="areia__palco" aria-hidden="true">
          <div className="areia__fixo">
            <img
              className="areia"
              src={areiaSrc}
              alt=""
              style={
                EFEITOS.parallax
                  ? { transform: `translate3d(0, ${deriva}px, 0) scale(1.08)` }
                  : undefined
              }
            />
            <span className="areia__veu" />
            {EFEITOS.haloMuda && (
              <span className="areia__halo" data-cap={opened ? active : "capa"} />
            )}
          </div>
        </div>

        {/* O quadro fica preso na tela enquanto o trilho rola por baixo: o
            layout é sempre o mesmo, e o que muda é a tela do aparelho e o
            passo aceso na lista. */}
        <div className="palco" ref={palcoRef}>
          <div className="palco__fixo">
            <div className="wrap quadro">
              <div className="sec__head">
                <span className="eyebrow mono">O aplicativo</span>
                <h2>Quatro telas. Nenhuma delas pede que você calcule nada.</h2>
                <p>
                  Role a página para percorrer o Gastô como ele é usado: do primeiro
                  olhar no mês até a leitura do que aquele mês significou.
                </p>
              </div>

              <div className="quadro__grid">
                <div className="quadro__fone">
                  <Phone width={phoneW} glow className="scene__fone on-ink">
                    {!opened ? (
                      <LockScreen ym={YM} />
                    ) : (
                      <PhoneApp
                        tab={CHAPTERS[active].tab}
                        tx={TX}
                        ym={YM}
                        cats={CATS}
                        account={DEMO_ACCOUNT}
                        home={LEDGER.home}
                      />
                    )}

                    {/* A faixa de luz reinicia a cada troca porque a chave muda,
                        e uma chave nova faz o React remontar o elemento. */}
                    {EFEITOS.passadaDeLuz && opened && (
                      <span className="passada" key={active} aria-hidden="true" />
                    )}
                  </Phone>
                </div>

                <ol className="etapas">
                  {EFEITOS.trilho && (
                    <span className="etapas__fio" aria-hidden="true" data-on={opened}>
                      <span
                        className="etapas__verde"
                        style={{
                          height: `${100 / CHAPTERS.length}%`,
                          transform: `translateY(${active * 100}%)`,
                        }}
                      />
                    </span>
                  )}

                  {CHAPTERS.map((c, i) => (
                    <li className="etapa" key={c.tag} data-on={opened && active === i}>
                      <button type="button" onClick={() => irPara(i)}>
                        <span className="etapa__n mono">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="etapa__txt">
                          <span className="etapa__t">{c.tag}</span>
                          <span className="etapa__d">{c.resumo}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- faixa de categorias ---------------- */}
      <div className="marquee on-ink" aria-hidden="true">
        <div className="marquee__track">
          {[0, 1].map((copy) => (
            <div className="marquee__set" key={copy}>
              {BASE_CATEGORIES.map((c) => (
                <span className="mchip" key={`${copy}-${c.id}`}>
                  <span className="mchip__e">{c.emoji}</span>
                  {c.label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- nota do mês ---------------- */}
      <section className="sec sec--ink on-ink glowable emenda emenda--claro" id="nota" ref={scoreRef}>
        <span className="glow" aria-hidden="true" />
        <div className="wrap score-s">
          <Gauge />
          <div>
            <span className="eyebrow mono">Nota do mês</span>
            <h2 style={{ fontSize: "clamp(30px,4vw,44px)", marginTop: 16, color: "#fff" }}>
              Um número só não ajuda ninguém. O motivo, sim.
            </h2>
            <p
              style={{
                marginTop: 16,
                color: "rgba(255,255,255,0.66)",
                fontSize: 17,
                lineHeight: 1.6,
                maxWidth: "52ch",
              }}
            >
              A nota sai de três pilares com pesos fixos: controle de gastos vale 50
              pontos, consistência ao longo do mês vale 30 e organização vale 20. As regras
              são as mesmas todo mês e ficam visíveis dentro do app. O mês de exemplo ao
              lado fechou assim:
            </p>

            <div className="reasons">
              {SCORE.pillars.map((p, i) => (
                <div className="reason" key={p.id}>
                  <Icon
                    name={i === 0 ? "wallet" : i === 1 ? "calendar" : "shield"}
                    size={16}
                  />
                  <span>
                    <span className="reason__h">
                      {p.label}
                      <span className="reason__w num">
                        {p.earned.toFixed(1).replace(".", ",")} de {p.weight}
                      </span>
                    </span>
                    {p.detail}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- recursos ---------------- */}
      <section className="sec sec--paper" id="recursos">
        <div className="wrap">
          <div className="sec__head rise">
            <span className="eyebrow mono">Recursos</span>
            <h2>Feito para quem vai usar todo mês, não só no primeiro.</h2>
          </div>
          <div className="feats">
            {FEATURES.map((f) => (
              <div className="feat rise rise--soft" key={f.title}>
                <span className="feat__ic">
                  <Icon name={f.icon} size={19} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ---------------- quem fez e por quê ---------------- */}
      <section className="sec sec--paper" id="origem">
        <div className="wrap origem">
          <div className="origem__head rise">
            <span className="eyebrow mono">Por que o Gastô existe</span>
            <h2>
              Fiz para mim primeiro. Se não desse certo para mais ninguém, já
              teria valido.
            </h2>
          </div>

          {/* É depoimento dele, na primeira pessoa, e não texto do site. As
              aspas existem para deixar isso claro de olhada: abrem no primeiro
              parágrafo e só fecham no último, como manda a norma para citação
              de mais de um parágrafo. */}
          <blockquote className="origem__txt rise rise--soft">
            <p>
              <span className="origem__aspa" aria-hidden="true">“</span>A ideia do Gastô
              surgiu quando eu tinha 17 anos, quando comecei a usar
              uma planilha no Google Sheets para controlar minhas primeiras mesadas.
              Funcionava, mas era trabalhoso: precisava ajustar fórmulas, abrir o
              arquivo toda vez e, no fim, a planilha só mostrava os números. Ela não
              me dizia se eu estava gastando bem, se o mês tinha sido bom ou onde eu
              poderia melhorar.
            </p>
            <p>
              Foi aí que percebi algo que me incomodou ainda mais: quase ninguém
              aprende a lidar com dinheiro. Educação financeira raramente faz parte
              da escola e, depois dela, muito menos. A maioria de nós começa a ganhar
              dinheiro e vai descobrindo tudo na prática, muitas vezes errando
              bastante e só percebendo o impacto depois.
            </p>
            <p>
              Eu não sou da área de tecnologia. Estudo Administração na UnB e quero
              seguir carreira em finanças. O Gastô nasceu justamente da minha própria
              experiência: é o aplicativo que eu gostaria de ter tido aos 17 anos.
            </p>
            <p>
              E talvez essa seja a parte mais importante da história: eu não criei o
              Gastô apenas para outras pessoas. Eu uso o aplicativo desde a primeira
              versão, todos os meses, com o meu próprio dinheiro. Cada melhoria que
              faço nasce, em grande parte, de uma necessidade que eu mesmo senti.
            </p>
            <p>
              No fim, o Gastô é a ferramenta que eu queria ter encontrado quando
              comecei a lidar com meu dinheiro: simples o suficiente para usar todos
              os dias e inteligente o suficiente para me ajudar a entender para onde
              meu dinheiro está indo.<span aria-hidden="true">”</span>
            </p>
            <cite className="origem__ass">Diego, criador do Gastô</cite>
          </blockquote>
        </div>
      </section>

      {/* ---------------- perguntas ---------------- */}
      {/* ---------------- instalar no celular ---------------- */}
      <section className="sec sec--paper" id="instalar">
        <div className="wrap">
          <div className="sec__head rise">
            <span className="eyebrow mono">Em trinta segundos</span>
            <h2>Deixe o Gastô na tela do seu celular.</h2>
            <p className="lede">
              Não tem loja, não tem download, não ocupa espaço. O Gastô vira um ícone junto dos
              seus outros aplicativos e abre em tela cheia, sem a barra do navegador.
            </p>

            {/* Selo nosso, não das lojas: o Gastô não está em nenhuma delas.
                Ele diz em duas linhas o que a pessoa ganha e o que não precisa. */}
            <div className="selo-app">
              <span className="selo-app__ic">
                <LogoMark size={22} ink="#07160b" />
              </span>
              <span>
                <span className="selo-app__k">Adicionar à tela inicial</span>
                <span className="selo-app__v">grátis · sem loja de aplicativos</span>
              </span>
            </div>
          </div>

          <div className="passos2">
            {(["iphone", "android"] as const).map((qual) => (
              <div className="passos2__col rise rise--soft" key={qual}>
                <span className="passos2__h">
                  <Icon name={qual === "iphone" ? "compartilhar" : "celular"} size={16} />
                  {qual === "iphone" ? "No iPhone" : "No Android"}
                </span>
                <ol className="passos">
                  {PASSOS_INSTALAR[qual].map((p, i) => (
                    <li className="passos__i" key={p}>
                      <span className="passos__n mono">{i + 1}</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec sec--paper emenda emenda--escuro" id="duvidas">
        <div className="wrap">
          <div className="sec__head rise">
            <span className="eyebrow mono">Antes de começar</span>
            <h2>As perguntas que todo mundo faz.</h2>
          </div>
          <div className="faq">
            {FAQ.map((f) => (
              <details className="faq__i rise rise--soft" key={f.q}>
                <summary>
                  {f.q}
                  <Icon name="chevronDown" size={16} />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- contato + chamada final ---------------- */}
      <section className="sec sec--ink on-ink glowable" id="contato" ref={closeRef}>
        <span className="glow" aria-hidden="true" />
        <div className="wrap">
          <div className="contact">
            <div>
              <span className="eyebrow mono">Contato</span>
              <h2 style={{ fontSize: "clamp(28px,3.6vw,40px)", marginTop: 16, color: "#fff" }}>
                Achou um problema ou tem uma ideia? Fale com a gente.
              </h2>
              <p
                style={{
                  marginTop: 16,
                  color: "rgba(255,255,255,0.62)",
                  fontSize: 16.5,
                  lineHeight: 1.6,
                  maxWidth: "46ch",
                }}
              >
                O Gastô é um projeto em construção e cada retorno de quem usa muda a
                próxima versão. Escreva, que eu respondo.
              </p>
            </div>

            <div className="contact__cards">
              <a className="ccard" href={`mailto:${CONTATO.email}`}>
                <span className="ccard__ic">
                  <Icon name="mail" size={20} />
                </span>
                <span className="ccard__txt">
                  <span className="ccard__l">E-mail</span>
                  <span className="ccard__v">{CONTATO.email}</span>
                </span>
              </a>
            </div>
          </div>

          <div
            style={{
              marginTop: "clamp(48px,7vw,84px)",
              paddingTop: "clamp(48px,7vw,84px)",
              borderTop: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <div className="cta">
              <LogoMark size={46} ink="#fff" />
              <h2>Comece o próximo mês sabendo o que esperar.</h2>
              <p>
                Crie sua conta e o Gastô já abre com um mês de exemplo, para você
                entender a lógica antes de registrar o primeiro gasto de verdade.
              </p>
              <Link to="/criar-conta" className="btn btn--acid">
                Entrar no Gastô
                <Icon name="arrowUpRight" size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="foot glowable" ref={footRef}>
        <span className="glow" aria-hidden="true" />
        <div className="wrap">
          <div className="foot__in">
            <div className="foot__col">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 9, color: "#fff" }}>
                <LogoMark size={22} ink="#fff" />
                <span
                  style={{
                    fontFamily: "var(--f-display)",
                    fontWeight: 600,
                    fontSize: 18,
                    letterSpacing: "-0.035em",
                  }}
                >
                  Gastô
                </span>
              </span>
              <p style={{ maxWidth: "34ch", marginTop: 4 }}>
                Controle de gastos pessoais com foco em entender o mês, não só
                registrar boletos.
              </p>
            </div>

            <div className="foot__col">
              <span className="mono foot__h">Site</span>
              <a href="#produto">Como funciona</a>
              <a href="#nota">Nota do mês</a>
              <a href="#recursos">Recursos</a>
              <a href="#origem">Quem fez</a>
              <a href="#duvidas">Dúvidas</a>
              <Link to="/entrar">Entrar no app</Link>
            </div>

            <div className="foot__col">
              <span className="mono foot__h">Contato</span>
              <a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a>
              <Link to="/privacidade">Privacidade</Link>
            </div>
          </div>

          <div className="foot__bar">
            <span>Gastô © {new Date().getFullYear()}</span>
            <span>Feito no Brasil</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---- medidor grande: o anel e o conteúdo avançam juntos na rolagem ---- */

const tierOf = (v: number) =>
  v >= 8.5 ? "Excelente" : v >= 7 ? "Saudável" : v >= 5 ? "Regular" : "Atenção";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function Gauge() {
  const size = 300;
  const t = 16;
  const r = (size - t) / 2;
  const c = 2 * Math.PI * r;
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 800;
    const start = vh * 0.92;
    const end = vh * 0.38;
    const raw = (start - rect.top) / (start - end);
    setP(Math.round(Math.min(1, Math.max(0, raw)) * 100) / 100);
  }, []);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [measure]);

  const value = SCORE.score * p;
  const filled = (value / 10) * c;
  const tier = tierOf(value);
  // nota baixa combina com muito da renda comprometida: a porcentagem
  // desce de 90% até o valor real enquanto o anel se preenche
  const burnShown = lerp(90, SCORE.burn, p);

  // o traço sai de um cinza frio e chega no verde da marca
  const stroke = `rgb(${Math.round(lerp(126, 18, p))} ${Math.round(
    lerp(140, 251, p)
  )} ${Math.round(lerp(132, 61, p))})`;

  return (
    <div className="gauge" ref={ref} style={{ width: size, height: size, maxWidth: "100%" }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Nota ${SCORE.score} de 10 em ${monthLabel(SHOWCASE_YM)}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={t}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={t}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke 0.3s linear" }}
        />
      </svg>
      <div className="gauge__val">
        <div className="gauge__n num" style={{ color: p > 0.08 ? "#fff" : "rgba(255,255,255,0.4)" }}>
          {value.toLocaleString("pt-BR", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
        </div>
        <div className="gauge__t" style={{ color: p > 0.08 ? stroke : "rgba(255,255,255,0.3)" }}>
          {p > 0.04 ? tier : "Calculando"}
        </div>
        <div className="gauge__s" style={{ opacity: p }}>
          {monthLabel(SHOWCASE_YM)} · {Math.round(burnShown)}% da renda gasta
        </div>
      </div>
    </div>
  );
}
