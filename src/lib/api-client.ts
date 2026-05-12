/**
 * Utilitário centralizado para chamadas de API autenticadas.
 * Injeta automaticamente o header Authorization com o token JWT armazenado no localStorage.
 * Deve ser usado em substituição a `fetch()` em todas as chamadas do frontend para APIs protegidas.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : null;

  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Preserva o Content-Type se já definido (ex: 'application/json'), mas não sobrescreve FormData
  // FormData precisa que o browser defina o boundary automaticamente
  return fetch(url, {
    ...options,
    headers,
  });
}
