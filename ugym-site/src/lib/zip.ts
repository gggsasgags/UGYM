/* ------------------------------------------------------------------
   Um remendo mínimo de .zip, só para o que a planilha precisa.

   A biblioteca que gera o .xlsx não sabe congelar o cabeçalho, e o
   cabeçalho parado no topo é o que faz a planilha ser legível quando
   passa de umas trinta linhas. Como o .xlsx é um zip de XMLs e essa
   biblioteca grava tudo sem compressão, dá para abrir o pacote, trocar
   um pedaço do XML da aba e fechar de novo.

   Regra de ouro daqui: na menor dúvida, devolve o arquivo original
   intacto. Um cabeçalho que não congelou é um detalhe. Um arquivo
   corrompido é o extrato da pessoa perdido.
-------------------------------------------------------------------*/

/** Bytes com buffer comum, que é o que Blob e fetch aceitam. */
type Bytes = Uint8Array<ArrayBuffer>;

const TABELA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Bytes): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = TABELA[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface Entrada {
  nome: Bytes;
  dados: Bytes;
  hora: number;
  data: number;
}

/**
 * Troca o conteúdo de um arquivo dentro do zip, remontando o pacote.
 *
 * Só lida com entradas guardadas sem compressão, que é exatamente como
 * a planilha sai. Qualquer coisa fora disso faz a função desistir.
 */
export function trocarNoZip(
  bytes: Bytes,
  alvo: string,
  troca: (xml: string) => string
): Bytes {
  try {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const texto = new TextDecoder();

    // o fim do índice central fica nos últimos bytes, depois de um comentário opcional
    let fim = -1;
    for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 22 - 0xffff; i--) {
      if (v.getUint32(i, true) === 0x06054b50) {
        fim = i;
        break;
      }
    }
    if (fim < 0) return bytes;

    const quantas = v.getUint16(fim + 10, true);
    let p = v.getUint32(fim + 16, true);

    const entradas: Entrada[] = [];
    let mexeu = false;

    for (let n = 0; n < quantas; n++) {
      if (v.getUint32(p, true) !== 0x02014b50) return bytes;
      const metodo = v.getUint16(p + 10, true);
      const hora = v.getUint16(p + 12, true);
      const data = v.getUint16(p + 14, true);
      const tamanho = v.getUint32(p + 20, true);
      const nomeLen = v.getUint16(p + 28, true);
      const extraLen = v.getUint16(p + 30, true);
      const comentLen = v.getUint16(p + 32, true);
      const local = v.getUint32(p + 42, true);
      const nome = bytes.subarray(p + 46, p + 46 + nomeLen);

      if (metodo !== 0) return bytes; // veio comprimido, não é o nosso caso

      if (v.getUint32(local, true) !== 0x04034b50) return bytes;
      const lNome = v.getUint16(local + 26, true);
      const lExtra = v.getUint16(local + 28, true);
      const inicio = local + 30 + lNome + lExtra;
      let dados = bytes.subarray(inicio, inicio + tamanho);

      if (texto.decode(nome) === alvo) {
        const novo = troca(texto.decode(dados));
        dados = new TextEncoder().encode(novo);
        mexeu = true;
      }

      entradas.push({ nome, dados, hora, data });
      p += 46 + nomeLen + extraLen + comentLen;
    }

    if (!mexeu) return bytes;

    /* remonta: cabeçalhos locais, depois o índice central, depois o fim */
    const corpo = entradas.reduce((s, e) => s + 30 + e.nome.length + e.dados.length, 0);
    const indice = entradas.reduce((s, e) => s + 46 + e.nome.length, 0);
    const saida = new Uint8Array(corpo + indice + 22);
    const s = new DataView(saida.buffer);
    const offsets: number[] = [];
    const cheques: number[] = [];

    let o = 0;
    for (const e of entradas) {
      offsets.push(o);
      const cheque = crc32(e.dados);
      cheques.push(cheque);
      s.setUint32(o, 0x04034b50, true);
      s.setUint16(o + 4, 20, true); // versão mínima
      s.setUint16(o + 6, 0, true); // sem sinalizador
      s.setUint16(o + 8, 0, true); // guardado, sem compressão
      s.setUint16(o + 10, e.hora, true);
      s.setUint16(o + 12, e.data, true);
      s.setUint32(o + 14, cheque, true);
      s.setUint32(o + 18, e.dados.length, true);
      s.setUint32(o + 22, e.dados.length, true);
      s.setUint16(o + 26, e.nome.length, true);
      s.setUint16(o + 28, 0, true);
      saida.set(e.nome, o + 30);
      saida.set(e.dados, o + 30 + e.nome.length);
      o += 30 + e.nome.length + e.dados.length;
    }

    const inicioIndice = o;
    entradas.forEach((e, i) => {
      s.setUint32(o, 0x02014b50, true);
      s.setUint16(o + 4, 20, true);
      s.setUint16(o + 6, 20, true);
      s.setUint16(o + 8, 0, true);
      s.setUint16(o + 10, 0, true);
      s.setUint16(o + 12, e.hora, true);
      s.setUint16(o + 14, e.data, true);
      s.setUint32(o + 16, cheques[i], true);
      s.setUint32(o + 20, e.dados.length, true);
      s.setUint32(o + 24, e.dados.length, true);
      s.setUint16(o + 28, e.nome.length, true);
      s.setUint16(o + 30, 0, true);
      s.setUint16(o + 32, 0, true);
      s.setUint16(o + 34, 0, true);
      s.setUint16(o + 36, 0, true);
      s.setUint32(o + 38, 0, true);
      s.setUint32(o + 42, offsets[i], true);
      saida.set(e.nome, o + 46);
      o += 46 + e.nome.length;
    });

    s.setUint32(o, 0x06054b50, true);
    s.setUint16(o + 4, 0, true);
    s.setUint16(o + 6, 0, true);
    s.setUint16(o + 8, entradas.length, true);
    s.setUint16(o + 10, entradas.length, true);
    s.setUint32(o + 12, o - inicioIndice, true);
    s.setUint32(o + 16, inicioIndice, true);
    s.setUint16(o + 20, 0, true);

    return saida;
  } catch {
    return bytes;
  }
}
