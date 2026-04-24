import { supabase } from '../lib/supabase';

export type Role = 'owner' | 'manager' | 'driver';

export interface User {
  id: string;
  tenant_id: string;
  login: string;
  password: string;
  roles: Role[];
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export type UserInput = Omit<User, 'id' | 'created_at' | 'updated_at'>;

// Same hierarchy as owner-crm — used for primary-icon selection
// and for routing after successful login (pick the "highest hat"
// as the default active role).
const ROLE_RANK: Record<Role, number> = { owner: 3, manager: 2, driver: 1 };

export function primaryRole(roles: Role[]): Role {
  return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a])[0];
}

export function sortRoles(roles: Role[]): Role[] {
  return [...roles].sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
}

export async function listUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as User[];
}

export async function createUser(input: UserInput): Promise<User> {
  const { data, error } = await supabase.from('users').insert(input).select().single();
  if (error) throw error;
  return data as User;
}

export async function updateUser(id: string, patch: Partial<UserInput>): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as User;
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) throw error;
}

export interface AuthSuccess {
  user: User;
  tenantName: string;
  modules: string[];
  logoUrl: string;
}

/**
 * Look up a user by login + password + role. Returns user with tenant info.
 * Throws on not found / wrong password / picked role not in user's roles.
 *
 * Post multi-role migration: `users.roles` is a text[] column. We filter
 * via `.contains('roles', [picked])` which matches any user whose roles
 * array includes the picked role. A user with ['owner','driver'] can log
 * in via either "Owner" or "Driver" button on the config-crm login screen.
 */
export async function authenticate(
  role: Role,
  login: string,
  password: string,
): Promise<AuthSuccess> {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('login', login)
    .eq('password', password)
    .contains('roles', [role])
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!user) throw new Error('Невірний логін, пароль або роль');

  // Stamp last_login so owner-crm's Online tab can show who's active.
  // Fire-and-forget — don't block login on this.
  void supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id);

  // Fetch tenant info (name + modules + logo) so success screen can show app links
  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('name, modules, logo_url')
    .eq('tenant_id', user.tenant_id)
    .maybeSingle();

  if (cErr) throw cErr;
  if (!client) throw new Error('Компанію не знайдено');

  const modules = (client.modules as string[]) ?? [];

  // Module-gated roles: driver requires 'driver' module on the tenant.
  // Owner and manager are always allowed (passenger is a baseline module).
  if (role === 'driver' && !modules.includes('driver')) {
    throw new Error('Водійська панель не підключена для вашої компанії. Зверніться до адміністратора.');
  }

  return {
    user: user as User,
    tenantName: client.name,
    modules,
    logoUrl: (client.logo_url as string) ?? '',
  };
}

/**
 * Role-agnostic auth. Used by the public "Scanner" entry in config-crm:
 * any user with valid login+password+is_active — regardless of role — can
 * enter the TTN scanner. The user's actual primary role is returned so the
 * session still reflects who they are.
 */
export async function authenticateAny(
  login: string,
  password: string,
): Promise<AuthSuccess> {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('login', login)
    .eq('password', password)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!user) throw new Error('Невірний логін або пароль');

  void supabase
    .from('users')
    .update({ last_login: new Date().toISOString() })
    .eq('id', user.id);

  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('name, modules, logo_url')
    .eq('tenant_id', user.tenant_id)
    .maybeSingle();

  if (cErr) throw cErr;
  if (!client) throw new Error('Компанію не знайдено');

  return {
    user: user as User,
    tenantName: client.name,
    modules: (client.modules as string[]) ?? [],
    logoUrl: (client.logo_url as string) ?? '',
  };
}
