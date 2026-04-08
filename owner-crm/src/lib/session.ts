// Reads the `boti_session` that config-crm writes to localStorage on login.
// owner-crm has no login screen of its own — users enter via config-crm,
// pick "Власник", authenticate, and get redirected here.

import { supabase } from './supabase';

export interface BotiSession {
  tenant_id: string;
  tenant_name: string;
  user_login: string;
  user_name: string;
  role: 'owner' | 'manager' | 'driver';
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

/**
 * Verifies that the session's user still exists in the DB, is active, and
 * still has the claimed role + tenant. Returns 'ok' / 'invalid' / reason.
 * Used at owner-crm startup so a user deleted/deactivated by super-admin
 * can't keep working against a stale localStorage session.
 */
export async function verifySession(s: BotiSession): Promise<
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'inactive' | 'role_changed' | 'error' }
> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, login, role, tenant_id, is_active')
      .eq('tenant_id', s.tenant_id)
      .eq('login', s.user_login)
      .maybeSingle();
    if (error) return { ok: false, reason: 'error' };
    if (!data) return { ok: false, reason: 'not_found' };
    if (data.is_active === false) return { ok: false, reason: 'inactive' };
    if (data.role !== s.role) return { ok: false, reason: 'role_changed' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
