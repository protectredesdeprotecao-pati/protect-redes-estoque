const TOKEN_SESSION_KEY = 'protect_redes_auth_token_v1';
const TOKEN_PERSIST_KEY = 'protect_redes_auth_token_persist_v1';

export const AUTH_UNAUTHORIZED_EVENT = 'protect:auth-unauthorized';

export function getAuthToken(): string | null {
  try {
    return (
      sessionStorage.getItem(TOKEN_SESSION_KEY) ||
      localStorage.getItem(TOKEN_PERSIST_KEY) ||
      null
    );
  } catch {
    return null;
  }
}

export function setAuthToken(token: string, remember = false): void {
  try {
    sessionStorage.setItem(TOKEN_SESSION_KEY, token);
    if (remember) {
      localStorage.setItem(TOKEN_PERSIST_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_PERSIST_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
    localStorage.removeItem(TOKEN_PERSIST_KEY);
  } catch {
    // ignore storage errors
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const resp = await fetch(input, { ...init, headers });
  if (resp.status === 401) {
    clearAuthToken();
    window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
  }
  return resp;
}
