import { supabase } from "./supabase";

/* ------------------------------------------------------------------
   Foto de perfil.

   Antes a foto virava um data URL de base64 e morava dentro da coluna
   `avatar_url` da tabela `profiles`. Funcionava, mas 256px em JPEG dão
   uns 20 kB, que viram uns 27 kB depois do base64, e essa linha é lida
   em toda abertura do aplicativo junto com o nome e o tema. Ou seja: a
   pessoa baixava a própria foto de novo toda vez, dentro de uma
   consulta que deveria ser instantânea.

   Agora o arquivo vai para o Storage, num balde privado, e a coluna
   guarda só o caminho. Para mostrar, a gente pede uma URL assinada, que
   expira sozinha. O balde é privado de propósito: foto de rosto não
   precisa ficar aberta na internet para quem descobrir o endereço.

   A coluna continua sendo `avatar_url`, sem mudança de schema. O que
   mudou foi o que se escreve nela.
-------------------------------------------------------------------*/

const BALDE = "avatars";

/** Oito horas. Serve para uma sessão inteira sem virar link eterno. */
const VALIDADE = 60 * 60 * 8;

/** Uma pasta por usuário, que é o que as políticas do Storage conferem. */
export const caminhoDoAvatar = (userId: string) => `${userId}/perfil.jpg`;

/** Avatar antigo, guardado como base64 dentro da tabela. */
export const ehLegado = (valor: string | undefined): boolean =>
  Boolean(valor && valor.startsWith("data:"));

/**
 * Envia a foto e devolve o caminho que vai para a coluna.
 *
 * `upsert` porque o caminho é fixo por usuário: trocar de foto é
 * sobrescrever, e assim ninguém acumula arquivo órfão no balde.
 */
export async function enviarAvatar(userId: string, arquivo: Blob): Promise<string> {
  const caminho = caminhoDoAvatar(userId);
  const { error } = await supabase()
    .storage.from(BALDE)
    .upload(caminho, arquivo, {
      upsert: true,
      contentType: "image/jpeg",
      cacheControl: "3600",
    });
  if (error) throw error;
  return caminho;
}

/** Apaga o arquivo. Some quando a pessoa tira a foto do perfil. */
export async function apagarAvatar(userId: string): Promise<void> {
  const { error } = await supabase().storage.from(BALDE).remove([caminhoDoAvatar(userId)]);
  /* Arquivo que não existe mais não é problema: o fim desejado já é esse. */
  if (error && !/not found/i.test(error.message)) throw error;
}

/**
 * Transforma o caminho guardado na coluna em endereço que o <img> aceita.
 *
 * Devolve undefined em vez de estourar: perfil sem foto, arquivo apagado
 * por fora ou rede ruim viram a inicial do nome na tela, que é o que já
 * acontecia antes. Foto é enfeite, não pode derrubar a abertura do app.
 */
export async function urlDoAvatar(valor: string | undefined): Promise<string | undefined> {
  if (!valor) return undefined;
  /* Legado: já é uma imagem completa, é só devolver. */
  if (ehLegado(valor)) return valor;
  try {
    const { data, error } = await supabase()
      .storage.from(BALDE)
      .createSignedUrl(valor, VALIDADE);
    if (error || !data?.signedUrl) return undefined;
    return data.signedUrl;
  } catch {
    return undefined;
  }
}

/** Converte o base64 antigo em arquivo, para a migração silenciosa. */
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
