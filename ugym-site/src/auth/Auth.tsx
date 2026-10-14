import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { LogoMark, Wordmark } from "../components/Logo";
import { useStore } from "../lib/store";
import { problemaNaSenha } from "./senha";
import "./auth.css";

/** Desenho oficial do "G" do Google, para o botão não virar um emoji. */
function GoogleMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2 5.1-4.4 6.7v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.4z"/>
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.3 15.5 46 24 46z"/>
      <path fill="#FBBC05" d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.2-2.9.7-4.3v-5.7H4.5C2.9 17.2 2 20.5 2 24s.9 6.8 2.5 9.7l7.3-5.4z"/>
      <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.5 2 8.1 6.7 4.5 14.3l7.3 5.7c1.7-5.2 6.5-9.3 12.2-9.3z"/>
    </svg>
  );
}

export function Auth({ mode }: { mode: "entrar" | "criar" }) {
  const { signIn, signUp, resendConfirmation, signInWithGoogle, pedirNovaSenha, account, ready } =
    useStore();
  const navigate = useNavigate();
  /* Quem acabou de se cadastrar chega aqui com o e-mail na mão, vindo
     da tela de criar conta: o aviso verde em cima explica o porquê. */
  const local = useLocation();
  const veioDoCadastro = (local.state as { pendente?: string } | null)?.pendente ?? "";
  const [name, setName] = useState("");
  const [email, setEmail] = useState(veioDoCadastro);
  /* As duas rotas usam este mesmo componente, então o React reaproveita a
     instância ao ir de /criar-conta para /entrar e os estados iniciais não
     rodam de novo. Por isso o e-mail pendente é lido da rota a cada render,
     e o campo é preenchido por efeito. */
  const [password, setPassword] = useState("");
  const [withDemo, setWithDemo] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  /** e-mail de um cadastro que ficou esperando o clique no link */
  const pendente = veioDoCadastro;
  const [reenviado, setReenviado] = useState(false);
  const [temGoogle, setTemGoogle] = useState(false);
  /* "Esqueci minha senha" não abre outra rota: vira um estado desta mesma
     tela, com o mesmo formulário sem o campo de senha. */
  const [recuperando, setRecuperando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  useEffect(() => {
    if (ready && account) navigate("/app", { replace: true });
  }, [ready, account, navigate]);

  useEffect(() => {
    if (!veioDoCadastro) return;
    setEmail(veioDoCadastro);
    setReenviado(false);
    setErr("");
  }, [veioDoCadastro]);

  useEffect(() => {
    let vivo = true;
    void import("../lib/supabase")
      .then((m) => m.provedores())
      .then((p) => vivo && setTemGoogle(p.google))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const entrarComGoogle = async () => {
    setErr("");
    setBusy(true);
    const res = await signInWithGoogle();
    if (!res.ok) {
      setBusy(false);
      setErr(res.error);
    }
    // deu certo: o navegador já está saindo para o Google
  };

  const reenviar = async () => {
    setErr("");
    setBusy(true);
    const res = await resendConfirmation(pendente);
    setBusy(false);
    if (res.ok) setReenviado(true);
    else setErr(res.error);
  };

  const pedirLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErr("Digite um e-mail válido para continuar.");
      return;
    }
    setBusy(true);
    await pedirNovaSenha(email);
    setBusy(false);
    /* A resposta é sempre a mesma, exista ou não conta com esse e-mail.
       Qualquer diferença aqui contaria para um estranho quem tem conta. */
    setEnviado(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErr("Digite um e-mail válido para continuar.");
      return;
    }
    if (mode === "criar") {
      /* As três regras do projeto, iguais às da troca de senha. Só no
         cadastro: barrar no login trancaria fora quem tem senha antiga de
         seis caracteres. */
      const problema = problemaNaSenha(password);
      if (problema) {
        setErr(problema);
        return;
      }
    } else if (password.length < 6) {
      setErr("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (mode === "criar" && !name.trim()) {
      setErr("Diga como podemos te chamar.");
      return;
    }

    setBusy(true);
    const res =
      mode === "criar"
        ? await signUp(name, email, password, withDemo)
        : await signIn(email, password);
    setBusy(false);

    if (!res.ok) {
      if (res.confirm) {
        /* Deu certo, só falta o clique no e-mail. Mudar de tela é o sinal
           mais claro disso: a pessoa cai no login, com o e-mail já
           preenchido e o aviso explicando o que falta. */
        navigate("/entrar", { state: { pendente: email.trim().toLowerCase() } });
        return;
      }
      setErr(res.error);
      return;
    }
    navigate("/app");
  };

  return (
    <div className="auth">
      <aside className="auth__side on-ink">
        <Link to="/" className="auth__brand">
          <Wordmark size={20} ink="#fff" />
        </Link>

        <div className="auth__pitch">
          <p className="mono" style={{ color: "var(--acid)" }}>Seu dinheiro, sem névoa</p>
          <h2>
            Todo mês fecha com uma
            <br />
            resposta, não com uma dúvida.
          </h2>
          <ul className="auth__list">
            <li>
              <Icon name="check" size={15} /> Fixos e variáveis separados desde o primeiro
              lançamento
            </li>
            <li>
              <Icon name="check" size={15} /> Uma nota de 0 a 10 que explica o próprio
              resultado
            </li>
            <li>
              <Icon name="check" size={15} /> Comparação mês a mês em uma tela só
            </li>
          </ul>
        </div>

        <p className="auth__foot">
          Seus lançamentos ficam na sua conta e só você enxerga. O Gastô nunca pede acesso
          ao seu banco, e a senha é guardada pelo Supabase, nunca em texto aberto.
        </p>
      </aside>

      <main className="auth__main">
        <Link to="/" className="auth__back">
          <Icon name="chevronLeft" size={16} /> Voltar ao site
        </Link>

        {recuperando ? (
          <form className="auth__form" onSubmit={pedirLink}>
            <LogoMark size={34} ink="var(--ink)" />
            <h1>Esqueceu a senha?</h1>
            <p className="auth__sub">
              Digite seu e-mail e a gente manda um link para escolher outra.
            </p>

            {enviado ? (
              <div className="auth__aviso" role="status">
                <span className="auth__aviso__selo" aria-hidden="true">
                  <Icon name="mail" size={18} />
                </span>
                <div>
                  <strong>Se existir uma conta com esse e-mail, o link já está a caminho.</strong>
                  <p>
                    Olhe também em spam e promoções. O link vale uma vez e precisa ser
                    aberto neste mesmo aparelho e navegador.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <label className="field">
                  <span>E-mail</span>
                  <input
                    id="rec-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    autoComplete="email"
                  />
                </label>

                {err && (
                  <p className="field__err" role="alert">
                    {err}
                  </p>
                )}

                <button
                  className="btn btn--primary"
                  type="submit"
                  disabled={busy}
                  style={{ width: "100%" }}
                >
                  {busy ? "Enviando…" : "Enviar o link"}
                </button>

                <p className="auth__sub" style={{ marginTop: 4 }}>
                  Se você costuma entrar com o Google, não precisa de senha: volte e use o
                  botão “Entrar com o Google”.
                </p>
              </>
            )}

            <p className="auth__switch">
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  setRecuperando(false);
                  setEnviado(false);
                  setErr("");
                }}
              >
                Voltar para entrar
              </button>
            </p>
          </form>
        ) : (
        <form className="auth__form" onSubmit={submit}>
          <LogoMark size={34} ink="var(--ink)" />
          <h1>{mode === "entrar" ? "Entrar no Gastô" : "Criar sua conta"}</h1>
          <p className="auth__sub">
            {mode === "entrar"
              ? "Continue de onde você parou."
              : "Leva menos de um minuto."}
          </p>

          {pendente && mode === "entrar" && (
            <div className="auth__aviso" role="status">
              <span className="auth__aviso__selo" aria-hidden="true">
                <Icon name="mail" size={18} />
              </span>
              <div>
                <strong>Falta confirmar o e-mail.</strong>
                <p>
                  Mandamos um link para <b>{pendente}</b>. Clique nele e volte aqui para
                  entrar. Se não apareceu, olhe em spam ou promoções.
                </p>
                {reenviado ? (
                  <span className="auth__aviso__ok">Enviamos de novo, pode demorar um minuto.</span>
                ) : (
                  <button type="button" className="linklike" onClick={reenviar} disabled={busy}>
                    {busy ? "Enviando…" : "Reenviar o e-mail"}
                  </button>
                )}
              </div>
            </div>
          )}

          {temGoogle && (
            <>
              <button
                type="button"
                className="btn btn--google"
                onClick={entrarComGoogle}
                disabled={busy}
              >
                <GoogleMark />
                {mode === "entrar" ? "Entrar com o Google" : "Continuar com o Google"}
              </button>
              <span className="auth__ou">ou com e-mail</span>
            </>
          )}

          {mode === "criar" && (
            <label className="field">
              <span>Como podemos te chamar?</span>
              <input
                id="au-nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                autoComplete="given-name"
              />
            </label>
          )}

          <label className="field">
            <span>E-mail</span>
            <input
              id="au-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>Senha</span>
            <input
              id="au-senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "criar" ? "8+ caracteres, com letra e número" : "sua senha"
              }
              autoComplete={mode === "criar" ? "new-password" : "current-password"}
            />
          </label>

          {mode === "entrar" && (
            <p className="auth__esqueci">
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  setRecuperando(true);
                  setEnviado(false);
                  setErr("");
                }}
              >
                Esqueci minha senha
              </button>
            </p>
          )}

          {mode === "criar" && (
            <fieldset className="start">
              <legend>Como você quer começar?</legend>
              <button
                type="button"
                className="start__opt"
                aria-pressed={withDemo}
                onClick={() => setWithDemo(true)}
              >
                <Icon name="eye" size={17} />
                <span>
                  <strong>Com dados de exemplo</strong>
                  Cinco meses preenchidos para explorar as telas. Dá para apagar tudo
                  depois em um clique.
                </span>
              </button>
              <button
                type="button"
                className="start__opt"
                aria-pressed={!withDemo}
                onClick={() => setWithDemo(false)}
              >
                <Icon name="plus" size={17} />
                <span>
                  <strong>Do zero</strong>
                  Conta vazia, para registrar seus próprios lançamentos desde o primeiro.
                </span>
              </button>
            </fieldset>
          )}

          {err && (
            <p className="field__err" role="alert">
              {err}
            </p>
          )}

          <button className="btn btn--primary" type="submit" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Um instante…" : mode === "entrar" ? "Entrar" : "Criar conta e começar"}
          </button>

          {/* O aviso fica embaixo do botão, e não numa caixinha de marcar:
              obrigar o clique não faz ninguém ler, e o que a lei pede é que
              o texto esteja à mão na hora da decisão. */}
          {mode === "criar" && (
            <p className="auth__legal">
              Ao criar a conta você concorda com a{" "}
              <Link to="/privacidade">política de privacidade</Link>.
            </p>
          )}

          <p className="auth__switch">
            {mode === "entrar" ? (
              <>
                Ainda não tem conta? <Link to="/criar-conta">Criar agora</Link>
              </>
            ) : (
              <>
                Já tem conta? <Link to="/entrar">Entrar</Link>
              </>
            )}
          </p>
        </form>
        )}
      </main>
    </div>
  );
}
