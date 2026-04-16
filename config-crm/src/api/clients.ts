import { supabase } from '../lib/supabase';

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  password: string | null;
  logo_url: string | null;
  modules: string[] | null;
  tags: string[] | null;
  created_at?: string;
  updated_at?: string;
}

export type ClientInput = Omit<Client, 'id' | 'created_at' | 'updated_at'>;

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
