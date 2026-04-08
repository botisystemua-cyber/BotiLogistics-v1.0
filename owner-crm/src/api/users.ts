import { supabase } from '../lib/supabase';

export type Role = 'owner' | 'manager' | 'driver';

export interface User {
  id: string;
  tenant_id: string;
  login: string;
  password: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  is_active: boolean | null;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export type UserInput = Omit<User, 'id' | 'created_at' | 'updated_at' | 'last_login'>;

export async function listUsersByTenant(tenantId: string): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as User[];
}

export async function createUserForTenant(
  tenantId: string,
  input: Omit<UserInput, 'tenant_id'>,
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .insert({ ...input, tenant_id: tenantId })
    .select()
    .single();
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
