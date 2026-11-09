// Автоматически добавляет токен входа ко всем запросам к /api/.
// Благодаря этому не нужно менять каждый fetch в каждой странице.
let authToken = null;

export function setAuthToken(token) {
  authToken = token || null;
}

const originalFetch = window.fetch.bind(window);

window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input?.url || '';
  const isApi = url.includes('/api/');
  if (!isApi) return originalFetch(input, init);

  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await originalFetch(input, { ...init, headers });

  // После успешного входа запоминаем токен (только в памяти, не в localStorage).
  if (url.endsWith('/api/login') && response.ok) {
    try {
      const data = await response.clone().json();
      if (data && data.token) authToken = data.token;
    } catch {
      /* ответ не JSON, токена нет */
    }
  }

  // Токен истёк или недействителен: просим приложение выйти на экран входа.
  if (response.status === 401 && !url.endsWith('/api/login')) {
    response.clone().json().then((data) => {
      if (data && data.code === 'auth_required') {
        authToken = null;
        window.dispatchEvent(new Event('auth-expired'));
      }
    }).catch(() => {});
  }

  return response;
};
