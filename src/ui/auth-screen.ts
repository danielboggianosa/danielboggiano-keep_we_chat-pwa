/**
 * Login / Register screen.
 * Connects to POST /api/auth/login, POST /api/auth/register, and Google OAuth.
 * Stores JWT tokens in memory via api-client.
 *
 * Requirements: 1.1, 1.2, 1.3, 7.1, 7.2, 9.1
 */

import { apiLogin, apiRegister, apiGoogleLogin, type ApiError } from './api-client';

const OAUTH_STATE_KEY = 'google_oauth_state';

/**
 * 6.2: Start the Google OAuth flow.
 * Generates a random state, saves it in sessionStorage, builds the Google
 * authorization URL with required parameters, and redirects the browser.
 */
export function startGoogleOAuth(): void {
  const state = crypto.randomUUID();
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
  const redirectUri = `${window.location.origin}/`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface AuthScreenCallbacks {
  onAuthenticated: () => void;
}

export interface AuthScreenAPI {
  element: HTMLElement;
}

export function createAuthScreen(cb: AuthScreenCallbacks): AuthScreenAPI {
  const el = document.createElement('div');
  el.className = 'screen active';

  let mode: 'login' | 'register' = 'login';

  /* 6.4: Show an error message in the UI */
  function showError(errorEl: HTMLElement, message: string): void {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function render(): void {
    const isLogin = mode === 'login';
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;">
        <div style="width:100%;max-width:380px;">
          <div style="text-align:center;margin-bottom:32px;">
            <div style="font-family:var(--font-display,sans-serif);font-size:28px;font-weight:800;color:var(--text-primary,#1a1a2e);">
              KeepWeChat
            </div>
            <div style="font-size:14px;color:var(--text-secondary,#666);margin-top:4px;">
              ${isLogin ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
            </div>
          </div>

          <form id="auth-form" style="display:flex;flex-direction:column;gap:14px;">
            ${!isLogin ? `
              <label style="display:flex;flex-direction:column;gap:4px;">
                <span style="font-size:13px;font-weight:600;color:var(--text-secondary,#666);">Nombre</span>
                <input type="text" name="name" required placeholder="Tu nombre"
                  style="padding:12px 14px;border:1px solid var(--border-color,#e0e0e0);border-radius:12px;font-size:15px;font-family:inherit;outline:none;" />
              </label>
            ` : ''}
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:13px;font-weight:600;color:var(--text-secondary,#666);">Email</span>
              <input type="email" name="email" required placeholder="tu@email.com" autocomplete="email"
                style="padding:12px 14px;border:1px solid var(--border-color,#e0e0e0);border-radius:12px;font-size:15px;font-family:inherit;outline:none;" />
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;">
              <span style="font-size:13px;font-weight:600;color:var(--text-secondary,#666);">Contraseña</span>
              <input type="password" name="password" required placeholder="••••••••" autocomplete="${isLogin ? 'current-password' : 'new-password'}" minlength="6"
                style="padding:12px 14px;border:1px solid var(--border-color,#e0e0e0);border-radius:12px;font-size:15px;font-family:inherit;outline:none;" />
            </label>

            <div id="auth-error" style="display:none;color:var(--accent-coral,#e74c3c);font-size:13px;text-align:center;"></div>

            <button type="submit" style="
              padding:14px;border:none;border-radius:14px;
              background:var(--accent-coral,#e74c3c);color:#fff;
              font-family:inherit;font-size:16px;font-weight:700;cursor:pointer;
              margin-top:4px;">
              ${isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          </form>

          <!-- 6.1: Google OAuth button, visible in both login and register modes -->
          <div style="display:flex;align-items:center;gap:12px;margin-top:18px;">
            <div style="flex:1;height:1px;background:var(--border-color,#e0e0e0);"></div>
            <span style="font-size:13px;color:var(--text-secondary,#666);">o</span>
            <div style="flex:1;height:1px;background:var(--border-color,#e0e0e0);"></div>
          </div>
          <button type="button" id="google-login-btn" style="
            width:100%;padding:14px;border:1px solid var(--border-color,#e0e0e0);border-radius:14px;
            background:#fff;color:var(--text-primary,#1a1a2e);
            font-family:inherit;font-size:15px;font-weight:600;cursor:pointer;
            margin-top:14px;display:flex;align-items:center;justify-content:center;gap:10px;">
            <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.0 24.0 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Iniciar sesión con Google
          </button>

          <div style="text-align:center;margin-top:20px;font-size:14px;color:var(--text-secondary,#666);">
            ${isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            <button type="button" id="auth-toggle" style="
              background:none;border:none;color:var(--accent-indigo,#6366f1);
              font-weight:600;cursor:pointer;font-size:14px;font-family:inherit;">
              ${isLogin ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </div>
        </div>
      </div>
    `;

    el.querySelector('#auth-toggle')!.addEventListener('click', () => {
      mode = mode === 'login' ? 'register' : 'login';
      render();
    });

    /* 6.1: Wire up Google button click → startGoogleOAuth */
    el.querySelector('#google-login-btn')!.addEventListener('click', () => {
      startGoogleOAuth();
    });

    const form = el.querySelector('#auth-form') as HTMLFormElement;
    const errorEl = el.querySelector('#auth-error') as HTMLElement;

    /*
     * 6.3: OAuth callback detection on screen load.
     * If the URL contains `code` and `state`, validate state against
     * sessionStorage, call apiGoogleLogin(code), and clean up.
     */
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      const savedState = sessionStorage.getItem(OAUTH_STATE_KEY);

      if (savedState && savedState === state) {
        // Valid state — proceed with Google login
        sessionStorage.removeItem(OAUTH_STATE_KEY);
        // Clean the URL (remove code/state params)
        window.history.replaceState({}, '', window.location.pathname);

        apiGoogleLogin(code)
          .then(() => cb.onAuthenticated())
          .catch((err) => {
            const apiErr = err as ApiError;
            showError(errorEl, apiErr.error ?? 'Error al iniciar sesión con Google');
          });
      } else {
        /* 6.4: State mismatch — show error and cancel the flow */
        sessionStorage.removeItem(OAUTH_STATE_KEY);
        window.history.replaceState({}, '', window.location.pathname);
        showError(errorEl, 'Error de seguridad: el parámetro state no coincide. Intenta de nuevo.');
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorEl.style.display = 'none';

      const fd = new FormData(form);
      const email = (fd.get('email') as string).trim();
      const password = fd.get('password') as string;
      const name = (fd.get('name') as string | null)?.trim() ?? '';

      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Cargando...';

      try {
        if (isLogin) {
          await apiLogin(email, password);
        } else {
          if (!name) {
            throw { status: 400, error: 'El nombre es obligatorio' } as ApiError;
          }
          await apiRegister(email, name, password);
        }
        cb.onAuthenticated();
      } catch (err) {
        const apiErr = err as ApiError;
        showError(errorEl, apiErr.error ?? 'Error de conexión');
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? 'Iniciar sesión' : 'Crear cuenta';
      }
    });
  }

  render();
  return { element: el };
}
