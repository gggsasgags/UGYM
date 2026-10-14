import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import "./legal.css";

/* ------------------------------------------------------------------
   A política de privacidade. Só ela.

   Existiram aqui também termos de uso e uma página de cookies. O Diego
   pediu, em 23/09/2026, para ficar só a privacidade. As duas páginas
   saíram, mas o que a página de cookies contava e o usuário precisa
   saber, porque acontece com ele sem ele pedir, não sumiu junto: virou
   as seções "O que fica guardado no seu navegador" e "O que sai do seu
   navegador sem você fazer nada", aqui dentro. Termos de uso são
   contrato, e não aviso, então esses foram embora inteiros.

   Tudo que está escrito aqui foi conferido no banco e no código em
   setembro de 2026, e não copiado de modelo pronto. Onde a checagem não
   deu para fazer, o texto diz isso em vez de afirmar.

   Duas coisas importantes para quem for mexer neste arquivo:

   1. Se o app mudar o que guarda, o que manda para fora ou o que faz com
      o extrato, ESTE TEXTO MUDA JUNTO, no mesmo commit. Política que
      descreve um aplicativo que não existe mais é pior do que nenhuma.
   2. Nada aqui é revisão jurídica. É a descrição honesta de um sistema,
      escrita por quem o construiu.
-------------------------------------------------------------------*/

export const CONTATO_PRIVACIDADE = "contatogasto@gmail.com";
const ATUALIZADO = "23 de setembro de 2026";

type Secao = { id: string; titulo: string; corpo: React.ReactNode };

function Pagina({
  chapeu,
  titulo,
  resumo,
  secoes,
}: {
  chapeu: string;
  titulo: string;
  resumo: React.ReactNode;
  secoes: Secao[];
}) {
  return (
    <div className="legal">
      <header className="legal__topo">
        <div className="wrap">
          <Link to="/" className="legal__voltar">
            <Icon name="chevronLeft" size={16} />
            Gastô
          </Link>
          {/* Uma página só, então não há aba para trocar: o que sobra no topo
              é o caminho de volta e o nome do documento. */}
          <span className="legal__aqui">Privacidade</span>
        </div>
      </header>

      <div className="wrap">
        <div className="legal__cab">
          <span className="legal__k">{chapeu}</span>
          <h1 className="legal__t">{titulo}</h1>
          <div className="legal__data">
            <span>Última atualização: {ATUALIZADO}</span>
          </div>
          <div className="legal__tldr">{resumo}</div>
        </div>

        <nav className="legal__sumario" aria-label="Seções desta página">
          <h2>Nesta página</h2>
          <ol>
            {secoes.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.titulo}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal__corpo">
          {secoes.map((s, i) => (
            <section key={s.id} id={s.id}>
              <h2>
                <span className="legal__n">{String(i + 1).padStart(2, "0")}</span>
                {s.titulo}
              </h2>
              {s.corpo}
            </section>
          ))}
        </div>

        <div className="legal__pe">
          <span>Gastô © {new Date().getFullYear()} · Brasília, DF</span>
          <a href={`mailto:${CONTATO_PRIVACIDADE}`}>{CONTATO_PRIVACIDADE}</a>
        </div>
      </div>
    </div>
  );
}

/* ============================ privacidade ============================ */

export function Privacidade() {
  return (
    <Pagina
      chapeu="Política de privacidade"
      titulo="O que o Gastô sabe sobre você"
      resumo={
        <>
          O Gastô guarda o seu nome, o seu e-mail e os lançamentos que você cria, para
          conseguir mostrar o seu mês. <strong>Não vende nada disso, não usa para anúncio
          e não cruza com outra base.</strong> O arquivo de extrato que você importa nem
          chega a sair do seu aparelho, e não existe banner de cookie aqui porque não
          existe cookie de rastreamento.
        </>
      }
      secoes={[
        {
          id: "quem",
          titulo: "Quem é responsável pelos seus dados",
          corpo: (
            <>
              <p>
                O Gastô é mantido por <strong>Diego Soares</strong>, pessoa física, em Brasília,
                Distrito Federal. É ele quem decide o que o aplicativo coleta e para quê, e por
                isso é o controlador dos dados na linguagem da Lei Geral de Proteção de Dados
                (Lei 13.709/2018).
              </p>
              <p>
                Para qualquer assunto de privacidade, inclusive os pedidos de{" "}
                <a href="#direitos">os seus direitos</a>, o contato é{" "}
                <a href={`mailto:${CONTATO_PRIVACIDADE}`}>{CONTATO_PRIVACIDADE}</a>. É o mesmo
                endereço que responde pelo papel de encarregado de dados.
              </p>
            </>
          ),
        },
        {
          id: "guarda",
          titulo: "O que o Gastô guarda",
          corpo: (
            <>
              <p>
                Esta lista foi conferida direto no banco de dados, tabela por tabela. Não é
                modelo de internet.
              </p>
              <dl className="legal__linhas">
                <div className="legal__linha">
                  <dt>E-mail e senha</dt>
                  <dd>
                    Para você entrar na sua conta. A senha nunca é guardada em texto: quem cuida
                    disso é o serviço de autenticação do Supabase, que armazena só uma versão
                    embaralhada dela. Nem eu consigo ler a sua senha.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>O nome que você escolheu</dt>
                  <dd>Aparece na saudação da tela inicial. Pode ser apelido, não precisa ser o nome do documento.</dd>
                </div>
                <div className="legal__linha">
                  <dt>Foto de perfil, se você puser uma</dt>
                  <dd>
                    Fica num repositório privado, de no máximo 2 MB, que só aceita imagem. Ela não
                    tem endereço público: o aplicativo gera um link temporário toda vez que precisa
                    mostrar a foto.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>Os seus lançamentos</dt>
                  <dd>
                    Descrição, valor, data, categoria, se é despesa ou receita, se é gasto fixo ou
                    variável, e o número da parcela quando existe. É o coração do aplicativo.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>Suas categorias e seus lançamentos repetidos</dt>
                  <dd>
                    As categorias que você cria ou apaga, os lançamentos que se repetem todo mês e
                    os meses em que você pulou um deles.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>As regras que você ensina na importação</dt>
                  <dd>
                    Quando você corrige uma linha do extrato, o Gastô guarda um resumo do texto
                    daquela linha, sem data nem número, junto com a sua decisão, para não perguntar
                    de novo no mês seguinte. Um trecho do texto original fica junto só para você
                    reconhecer a regra na tela.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>Suas preferências</dt>
                  <dd>
                    Tema claro ou escuro, calculadora ligada ou desligada, e a ordem dos blocos da
                    sua tela inicial.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>Datas de criação</dt>
                  <dd>Quando a conta e cada lançamento foram criados.</dd>
                </div>
              </dl>
              <p>
                Se você entrar com a conta do Google, o Google devolve ao Gastô o seu e-mail e o
                seu nome. Nada além disso.
              </p>
            </>
          ),
        },
        {
          id: "extrato",
          titulo: "O extrato que você importa não sai do seu aparelho",
          corpo: (
            <>
              <p>
                Este é o ponto que mais importa, então ele tem seção própria. Quando você importa
                um extrato em PDF, Excel ou CSV, <strong>o arquivo é lido dentro do seu próprio
                navegador</strong>. Ele não é enviado para nenhum servidor, nem para o meu, nem
                para o de terceiro, e não fica guardado em lugar nenhum depois que você fecha a
                tela.
              </p>
              <p>
                O que chega ao banco de dados são apenas os lançamentos que você conferiu e
                confirmou, do mesmo jeito que se você os tivesse digitado à mão. Tudo que você
                deixou de fora na conferência simplesmente não existe para o Gastô.
              </p>
            </>
          ),
        },
        {
          id: "nao",
          titulo: "O que o Gastô não faz",
          corpo: (
            <ul>
              <li>
                <strong>Não vende e não compartilha</strong> os seus dados com anunciante, banco,
                seguradora, birô de crédito ou qualquer outra empresa.
              </li>
              <li>
                <strong>Não monta perfil de consumo</strong> para te oferecer produto, nem seu nem
                de ninguém.
              </li>
              <li>
                <strong>Não se conecta ao seu banco.</strong> O Gastô não pede sua senha de banco,
                não usa Open Finance e não tem acesso nenhum às suas contas. Ele só sabe o que
                você digita ou importa.
              </li>
              <li>
                <strong>Não guarda número de cartão, conta, agência ou CPF.</strong> O aplicativo
                não tem nem onde colocar esses dados.
              </li>
              <li>
                <strong>Não lê os seus lançamentos para nada além de te mostrar.</strong> Quando eu
                preciso de número para saber se o aplicativo está sendo usado, eu olho contagem:
                quantas contas existem, quantas pessoas lançaram algo. Nunca a descrição nem o
                valor do que alguém gastou.
              </li>
            </ul>
          ),
        },
        {
          /* Isto morava na página de cookies, que deixou de existir. A lei
             pede que o aviso esteja à mão, e não que tenha página própria. */
          id: "navegador",
          titulo: "O que fica guardado no seu navegador",
          corpo: (
            <>
              <p>
                <strong>O Gastô não usa cookie de rastreamento, e por isso não tem banner de
                cookie.</strong> O que ele deixa no seu aparelho são duas coisas, e as duas servem
                para o aplicativo funcionar.
              </p>
              <dl className="legal__linhas">
                <div className="legal__linha">
                  <dt>A sua sessão</dt>
                  <dd>
                    Um código que diz ao aplicativo que é você, para não pedir a senha a cada vez.
                    Fica no armazenamento local do navegador, não é cookie, e some quando você sai
                    da conta ou limpa os dados do site.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>O olhinho dos valores</dt>
                  <dd>
                    Se você escondeu os valores da tela, o navegador lembra dessa escolha. É um
                    liga e desliga, e só.
                  </dd>
                </div>
              </dl>
              <p>
                Nada disso vai para servidor nenhum e nada disso serve para te seguir por outros
                sites. Sair da conta já apaga a sessão; para tirar o resto, limpe os dados do site
                usegasto.com nas configurações do navegador. Isso não apaga os seus lançamentos,
                que ficam no servidor: para apagar de verdade, veja{" "}
                <a href="#direitos">os seus direitos</a>.
              </p>
            </>
          ),
        },
        {
          id: "onde",
          titulo: "Onde os seus dados ficam",
          corpo: (
            <>
              <p>
                No Supabase, numa base de dados hospedada na <strong>região de São Paulo</strong>.
                Os seus lançamentos ficam em servidor no Brasil.
              </p>
              <p>
                Cada linha do banco tem o dono marcado, e existe uma trava no próprio banco de
                dados que impede uma conta de ler a linha de outra. Não é só o aplicativo que
                filtra: é o banco que recusa.
              </p>
            </>
          ),
        },
        {
          id: "terceiros",
          titulo: "Quem mais encosta nos seus dados",
          corpo: (
            <>
              <p>
                São três empresas, e cada uma vê uma parte diferente. Nenhuma delas recebe os seus
                dados para usar por conta própria.
              </p>
              <dl className="legal__linhas">
                <div className="legal__linha">
                  <dt>Supabase</dt>
                  <dd>
                    Guarda o banco de dados, cuida do login e envia os e-mails de confirmação de
                    cadastro e de recuperação de senha. É onde os seus lançamentos moram.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>Vercel</dt>
                  <dd>
                    Hospeda o site e mede as visitas. A medição é sem cookie e sem identificar
                    ninguém: a lista exata do que é coletado está na{" "}
                    <a href="#sai">seção seguinte</a>.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>Google</dt>
                  <dd>
                    Só entra em dois momentos: se você escolher entrar com a conta Google, que é
                    opcional e devolve ao Gastô apenas o seu nome e o seu e-mail, e no carregamento
                    das fontes do site. O segundo caso está explicado com franqueza na{" "}
                    <a href="#sai">seção seguinte</a>, porque ele acontece mesmo sem você ter conta.
                  </dd>
                </div>
              </dl>
            </>
          ),
        },
        {
          /* O resto da antiga página de cookies. Continua aqui pelo mesmo
             motivo de sempre: acontece com a pessoa sem ela pedir. */
          id: "sai",
          titulo: "O que sai do seu navegador sem você fazer nada",
          corpo: (
            <>
              <h3>A medição de visitas</h3>
              <p>
                O site usa a medição de visitas da Vercel, que é feita sem cookie. Em vez de te
                marcar, ela cria um código embaralhado a partir da requisição, que é descartado
                depois de 24 horas. Isso permite contar quantas pessoas visitaram sem saber quem
                são. A cada visita, estes dados são registrados:
              </p>
              <ul>
                <li>data e hora</li>
                <li>a tela do site que foi aberta</li>
                <li>de onde o link veio, quando veio de outro site</li>
                <li>país, região e cidade aproximados</li>
                <li>sistema, navegador e tipo de aparelho, com as versões</li>
              </ul>
              <p>
                As telas do Gastô não levam nome, e-mail nem valor no endereço, então não há dado
                seu para vazar por aí. Essa informação fica só comigo, em contagem, para eu saber
                se alguém está usando o aplicativo.
              </p>

              <h3>As fontes do site</h3>
              <p>
                O site carrega as suas letras do serviço de fontes do Google. Para isso acontecer,
                o seu navegador precisa pedir o arquivo ao Google, e nesse pedido{" "}
                <strong>o seu endereço de internet e o seu navegador ficam visíveis para o
                Google</strong>, mesmo que você nunca tenha criado conta no Gastô.
              </p>
              <div className="legal__nota legal__nota--atencao">
                <p>
                  Isso está escrito aqui porque é verdade, e não porque é bonito. Dá para resolver
                  servindo as fontes do próprio site, e essa mudança está na fila. Quando ela
                  entrar, este pedaço some.
                </p>
              </div>
            </>
          ),
        },
        {
          id: "tempo",
          titulo: "Por quanto tempo",
          corpo: (
            <p>
              Enquanto a sua conta existir. O Gastô é um histórico: apagar sozinho o seu mês de
              janeiro seria quebrar justamente o que você veio buscar. No segundo em que você
              apagar a conta, tudo vai junto, como está na seção seguinte.
            </p>
          ),
        },
        {
          id: "direitos",
          titulo: "Os seus direitos, e como usar",
          corpo: (
            <>
              <p>
                A Lei Geral de Proteção de Dados te dá direito a saber o que existe sobre você,
                corrigir, levar embora e apagar. Na prática, no Gastô:
              </p>
              <dl className="legal__linhas">
                <div className="legal__linha">
                  <dt>Ver e corrigir</dt>
                  <dd>
                    Você já faz isso sozinho, a qualquer hora, dentro do aplicativo. Todo lançamento
                    pode ser editado ou apagado por você.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>Levar embora</dt>
                  <dd>
                    A tela de exportar gera uma planilha com os seus lançamentos, que abre em
                    qualquer programa. Não precisa pedir para ninguém.
                  </dd>
                </div>
                <div className="legal__linha">
                  <dt>Apagar a conta inteira</dt>
                  <dd>
                    Você faz sozinho, na hora, sem pedir para ninguém: abra o seu perfil dentro do
                    aplicativo e vá até o fim, em <strong>Apagar a minha conta</strong>. Some tudo
                    de uma vez, e some para valer.
                  </dd>
                </div>
              </dl>
              <div className="legal__nota">
                <p>
                  <strong>Apagar não tem desfazer.</strong> Não vai para uma lixeira, não fica uma
                  cópia guardada por trinta dias e não existe pedido de recuperação depois. Por
                  isso o aplicativo pede que você escreva a palavra APAGAR antes, e oferece a
                  exportação dos seus lançamentos na mesma tela. Se quiser guardar o histórico,
                  baixe antes.
                </p>
                <p>
                  Se por algum motivo o botão falhar, escreva para{" "}
                  <a href={`mailto:${CONTATO_PRIVACIDADE}`}>{CONTATO_PRIVACIDADE}</a> do endereço
                  cadastrado e eu apago em até 15 dias, confirmando quando terminar.
                </p>
              </div>
            </>
          ),
        },
        {
          id: "seguranca",
          titulo: "O que é feito para proteger",
          corpo: (
            <>
              <ul>
                <li>Tudo trafega por conexão criptografada.</li>
                <li>
                  O banco recusa, na própria camada de dados, que uma conta leia ou escreva na
                  linha de outra.
                </li>
                <li>A chave que o site usa no navegador é pública de propósito e não abre nada sozinha.</li>
                <li>As fotos ficam num repositório privado, com link temporário.</li>
                <li>
                  O site declara ao navegador de onde pode carregar código, o que reduz o estrago
                  de um script injetado.
                </li>
              </ul>
              <p>
                Nenhum sistema é inviolável, e eu não vou escrever aqui que este é. Se algum dia
                acontecer um incidente com os seus dados, você será avisado por e-mail, com o que
                aconteceu e o que fazer.
              </p>
            </>
          ),
        },
        {
          id: "menores",
          titulo: "Menores de idade",
          corpo: (
            <p>
              O Gastô não é feito para crianças. Se você tem menos de 18 anos, use com o
              conhecimento de quem é responsável por você. Se eu souber que uma conta é de criança
              sem esse consentimento, ela será apagada.
            </p>
          ),
        },
        {
          id: "mudancas",
          titulo: "Se esta política mudar",
          corpo: (
            <p>
              A data no topo diz quando foi a última alteração. Se a mudança for grande, como
              passar a coletar algo novo, você será avisado por e-mail antes de ela valer, e não
              depois.
            </p>
          ),
        },
      ]}
    />
  );
}
