// Reads the `boti_session` that config-crm writes to localStorage on login.
// driver-crm has no login screen of its own — users enter via config-crm,
// pick "Водій", authenticate, and get redirected here.

export interface BotiSession {
  tenant_id: string;
  tenant_name: string;
  user_login: string;
  user_name: string;
  role: string;
  roles?: string[];
  modules: string[];
}

const SESSION_KEY = 'boti_session';
const CONFIG_CRM_URL = '../config-crm/';

export function readSession(): BotiSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as BotiSession;
    if (!s || !s.tenant_id || !s.role) return null;
    return s;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function logout() {
  clearSession();
  window.location.href = CONFIG_CRM_URL;
}

export function redirectToLogin() {
  window.location.href = CONFIG_CRM_URL;
}
