/**
 * Login / Register screen.
 * Connects to POST /api/auth/login and POST /api/auth/register.
 * Stores JWT tokens in memory via api-client.
 *
 * Requirements: 7.1, 9.1
 */

import { apiLogin, apiRegister, type ApiError } from './api-client';

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

    const form = el.querySelector('#auth-form') as HTMLFormElement;
    const errorEl = el.querySelector('#auth-error') as HTMLElement;

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
        errorEl.textContent = apiErr.error ?? 'Error de conexión';
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? 'Iniciar sesión' : 'Crear cuenta';
      }
    });
  }

  render();
  return { element: el };
}
