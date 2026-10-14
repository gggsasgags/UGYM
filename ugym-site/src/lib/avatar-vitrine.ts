/* ------------------------------------------------------------------
   A foto de perfil da vitrine.

   Sósia do avatar.ts, sem Storage. A foto escolhida vira um data URL
   guardado no navegador, o que é justamente o formato antigo que o app
   ainda sabe ler. Assim trocar e tirar a foto funciona na vitrine sem
   nenhuma linha de tela precisar saber disso.
-------------------------------------------------------------------*/

const CHAVE = "gasto-vitrine-foto";

export const caminhoDoAvatar = (userId: string) => `${userId}/perfil.jpg`;

export const ehLegado = (valor: string | undefined): boolean =>
  Boolean(valor && valor.startsWith("data:"));

const guardar = (valor: string | null) => {
  try {
    if (valor) localStorage.setItem(CHAVE, valor);
    else localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento: a foto vale enquanto a aba viver */
  }
};

let emMemoria: string | null = null;

export async function enviarAvatar(_userId: string, arquivo: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Não deu para ler a imagem."));
    leitor.readAsDataURL(arquivo);
  });
  emMemoria = dataUrl;
  guardar(dataUrl);
  /* O app guarda o que voltar daqui na coluna do perfil, e depois pede a
     URL. Devolvendo o próprio data URL, os dois caminhos fecham. */
  return dataUrl;
}

export async function apagarAvatar(_userId: string): Promise<void> {
  emMemoria = null;
  guardar(null);
}

export async function urlDoAvatar(valor: string | undefined): Promise<string | undefined> {
  if (valor && ehLegado(valor)) return valor;
  if (emMemoria) return emMemoria;
  try {
    return localStorage.getItem(CHAVE) ?? undefined;
  } catch {
    return undefined;
  }
}

export function legadoParaBlob(dataUrl: string): Blob | null {
  try {
    const [cabeca, corpo] = dataUrl.split(",");
    if (!corpo) return null;
    const tipo = /data:([^;]+)/.exec(cabeca)?.[1] ?? "image/jpeg";
    const bin = atob(corpo);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: tipo });
  } catch {
    return null;
  }
}
