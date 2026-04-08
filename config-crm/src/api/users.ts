import { supabase } from '../lib/supabase';

export type Role = 'owner' | 'manager' | 'driver';

export interface User {
  id: string;
  tenant_id: string;
  login: string;
  password: string;
  role: Role;
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export type UserInput = Omit<User, 'id' | 'created_at' | 'updated_at'>;

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
}

/**
 * Look up a user by login + password + role. Returns user with tenant info.
 * Throws on not found / wrong password / wrong role.
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
    .eq('role', role)
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

  // Fetch tenant info (name + modules) so success screen can show app links
  const { data: client, error: cErr } = await supabase
    .from('clients')
    .select('name, modules')
    .eq('tenant_id', user.tenant_id)
    .maybeSingle();

  if (cErr) throw cErr;
  if (!client) throw new Error('Компанію не знайдено');

  return {
    user: user as User,
    tenantName: client.name,
    modules: (client.modules as string[]) ?? [],
  };
}
