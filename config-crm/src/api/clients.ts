import { supabase } from '../lib/supabase';

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  password: string | null;
  logo_url: string | null;
  modules: string[] | null;
  tags: string[] | null;
  is_beta: boolean;
  beta_expires_at: string | null;
  beta_promoted_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export type ClientInput = Omit<Client, 'id' | 'created_at' | 'updated_at' | 'beta_promoted_at'>;

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Client[];
}

export async function createClient(input: ClientInput): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Client;
}

export async function updateClient(id: string, patch: Partial<ClientInput>): Promise<Client> {
  const { data, error } = await supabase
    .from('clients')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// ── Beta tenant management ──
// Знімає is_beta з тенанта (бета → основна версія).
export async function promoteTenant(tenantId: string): Promise<void> {
  const { data, error } = await supabase.rpc('promote_tenant', { p_tenant_id: tenantId });
  if (error) throw error;
  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    throw new Error((data as { error?: string }).error ?? 'promote_tenant failed');
  }
}

// Каскадно видаляє весь тенант: всі таблиці public.* з tenant_id + сам рядок у clients.
// Для безпеки вимагає, щоб confirm точно дорівнював tenant_id.
export async function deleteTenantCascade(tenantId: string): Promise<{
  total: number;
  breakdown: Record<string, number>;
}> {
  const { data, error } = await supabase.rpc('delete_tenant_data', {
    p_tenant_id: tenantId,
    p_confirm: tenantId,
  });
  if (error) throw error;
  const result = data as { ok: boolean; error?: string; total?: number; breakdown?: Record<string, number> };
  if (!result?.ok) throw new Error(result?.error ?? 'delete_tenant_data failed');
  return { total: result.total ?? 0, breakdown: result.breakdown ?? {} };
}
