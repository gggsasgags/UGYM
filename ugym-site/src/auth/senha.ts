/**
 * As regras de senha do projeto, num lugar só.
 *
 * São exatamente as três que o Supabase aplica: 8 caracteres, pelo menos
 * uma letra e pelo menos um número. Conferir aqui evita a viagem até o
 * servidor só para voltar com uma recusa em inglês.
 *
 * Vale para criar conta e para trocar a senha. Não vale para entrar: quem
 * tem conta antiga pode ter senha de 6 caracteres, e barrar no login
 * trancaria essa pessoa fora da própria conta.
 */
export function problemaNaSenha(senha: string): string {
  if (senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(senha)) return "A senha precisa ter pelo menos uma letra.";
  if (!/[0-9]/.test(senha)) return "A senha precisa ter pelo menos um número.";
  return "";
}
