import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { LogoMark, Wordmark } from "../components/Logo";
import { useStore } from "../lib/store";
import { problemaNaSenha } from "./senha";
import "./auth.css";

/* ------------------------------------------------------------------
   Tela de trocar a senha, para onde o link do e-mail leva.

   O link volta como `https://dominio/?code=...#/nova-senha`. O código do
   PKCE fica na query, antes do "#", então ele não encosta no roteador. O
   cliente do Supabase troca esse código por sessão sozinho durante a
   inicialização, e por isso esta tela só precisa esperar o `ready` do
   store e olhar se existe conta.

   Quem libera o formulário é a marca `recuperacao` do store, ligada só
   pelo evento `PASSWORD_RECOVERY` que a biblioteca dispara depois da
   troca. A rota sozinha não basta: sessão normal que cai aqui vê o aviso
   de que esta tela é da recuperação, e não o formulário.

   O caso de não haver sessão é comum e tem um motivo só: o verificador do
   PKCE fica guardado no navegador que pediu a troca. Abrir o link em
   outro aparelho não falha com erro, simplesmente não abre sessão.
-------------------------------------------------------------------*/

export function NovaSenha() {
  const { definirSenha, account, ready, recuperacao, signOut } = useStore();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [repete, setRepete] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [pronto, setPronto] = useState(false);

  /* Depois de trocar, a sessão do link vira a sessão normal da pessoa.
     Três segundos de confirmação e ela entra direto no aplicativo. */
  useEffect(() => {
    if (!pronto) return;
    const t = setTimeout(() => navigate("/app", { replace: true }), 2600);
    return () => clearTimeout(t);
  }, [pronto, navigate]);

  const semSessao = ready && !account;
  /* Sessão existe, mas não nasceu do link: é alguém já logado que digitou
     a rota, ou que recarregou a página no meio da troca. */
  const sessaoNormal = ready && !!account && !recuperacao;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const problema = problemaNaSenha(senha);
    if (problema) {
      setErr(problema);
      return;
    }
    if (senha !== repete) {
      setErr("As duas senhas não estão iguais.");
      return;
    }
    setBusy(true);
    const res = await definirSenha(senha);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setPronto(true);
  };

  return (
    <div className="auth">
      <aside className="auth__side on-ink">
        <Link to="/" className="auth__brand">
          <Wordmark size={20} ink="#fff" />
        </Link>

        <div className="auth__pitch">
          <p className="mono" style={{ color: "var(--acid)" }}>Quase lá</p>
          <h2>
            Escolha uma senha nova
            <br />e volte para o seu mês.
          </h2>
          <ul className="auth__list">
            <li>
              <Icon name="check" size={15} /> O link vale uma vez só e expira sozinho
            </li>
            <li>
              <Icon name="check" size={15} /> A senha é guardada pelo Supabase, nunca em
              texto aberto
            </li>
            <li>
              <Icon name="check" size={15} /> Seus lançamentos continuam exatamente onde
              estavam
            </li>
          </ul>
        </div>

        <p className="auth__foot">
          Se você não pediu esta troca, pode fechar esta página. Sua senha atual continua
          valendo enquanto ninguém escolher uma nova por aqui.
        </p>
      </aside>

      <main className="auth__main">
        <Link to="/entrar" className="auth__back">
          <Icon name="chevronLeft" size={16} /> Voltar para entrar
        </Link>

        {!ready ? (
          <div className="auth__form">
            <LogoMark size={34} ink="var(--ink)" />
            <h1>Abrindo o link…</h1>
            <p className="auth__sub">Um instante enquanto a gente confere.</p>
          </div>
        ) : pronto ? (
          <div className="auth__form">
            <LogoMark size={34} ink="var(--ink)" />
            <h1>Senha trocada</h1>
            <p className="auth__sub">
              Pronto. Estamos te levando para o aplicativo.
            </p>
            <div className="auth__aviso" role="status">
              <span className="auth__aviso__selo" aria-hidden="true">
                <Icon name="check" size={18} />
              </span>
              <div>
                <strong>Já pode entrar com a senha nova.</strong>
                <p>
                  Da próxima vez, use este e-mail e a senha que você acabou de escolher.
                </p>
              </div>
            </div>
          </div>
        ) : sessaoNormal ? (
          <div className="auth__form">
            <LogoMark size={34} ink="var(--ink)" />
            <h1>Esta tela é da recuperação</h1>
            <p className="auth__sub">
              Ela só abre para quem chegou pelo link do e-mail.
            </p>
            <div className="auth__aviso" role="status">
              <span className="auth__aviso__selo" aria-hidden="true">
                <Icon name="mail" size={18} />
              </span>
              <div>
                <strong>Você já está com a conta aberta neste aparelho.</strong>
                <p>
                  Trocar a senha por aqui sem passar pela recuperação não é permitido, para
                  que ninguém com acesso a um aparelho destravado consiga trancar você fora
                  da própria conta.
                </p>
                <p>
                  Se você veio pelo link do e-mail e recarregou a página, peça um link novo:
                  o recarregamento desfaz a recuperação em andamento.
                </p>
              </div>
            </div>
            <Link className="btn btn--primary" to="/app" style={{ width: "100%" }}>
              Voltar para o aplicativo
            </Link>
            <p className="auth__switch">
              Quer trocar a senha?{" "}
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  signOut();
                  navigate("/entrar", { replace: true });
                }}
              >
                Sair e pedir um link
              </button>
            </p>
          </div>
        ) : semSessao ? (
          <div className="auth__form">
            <LogoMark size={34} ink="var(--ink)" />
            <h1>Este link não abriu</h1>
            <p className="auth__sub">
              Acontece, e quase sempre pelo mesmo motivo.
            </p>
            <div className="auth__aviso" role="status">
              <span className="auth__aviso__selo" aria-hidden="true">
                <Icon name="mail" size={18} />
              </span>
              <div>
                <strong>Abra o link no mesmo aparelho onde você pediu.</strong>
                <p>
                  Por segurança, a chave que destrava a troca fica guardada no navegador
                  que fez o pedido. Se você pediu no computador e abriu no celular, ou
                  usou uma janela anônima, o link não funciona. Peça um novo pelo aparelho
                  em que for trocar a senha.
                </p>
                <p>O link também pode simplesmente ter expirado ou já ter sido usado.</p>
              </div>
            </div>
            <Link className="btn btn--primary" to="/entrar" style={{ width: "100%" }}>
              Pedir um link novo
            </Link>
          </div>
        ) : (
          <form className="auth__form" onSubmit={submit}>
            <LogoMark size={34} ink="var(--ink)" />
            <h1>Escolha a nova senha</h1>
            <p className="auth__sub">
              {account?.email ? `Trocando a senha de ${account.email}.` : "Quase pronto."}
            </p>

            <label className="field">
              <span>Nova senha</span>
              <input
                id="ns-senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="8+ caracteres, com letra e número"
                autoComplete="new-password"
              />
            </label>

            <label className="field">
              <span>Repita a nova senha</span>
              <input
                id="ns-repete"
                type="password"
                value={repete}
                onChange={(e) => setRepete(e.target.value)}
                placeholder="a mesma de cima"
                autoComplete="new-password"
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
              {busy ? "Salvando…" : "Salvar a nova senha"}
            </button>

            <p className="auth__switch">
              Mudou de ideia?{" "}
              <button
                type="button"
                className="linklike"
                onClick={() => {
                  signOut();
                  navigate("/entrar", { replace: true });
                }}
              >
                Sair sem trocar
              </button>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
