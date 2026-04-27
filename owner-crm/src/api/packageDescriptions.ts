import { supabase } from '../lib/supabase';

// ================================================================
// Типи
// ================================================================

export interface PackageDescription {
  id: number;
  tenant_id: string;
  text: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type PackageDescriptionInput = Pick<
  PackageDescription,
  'text' | 'sort_order'
>;

// Стандартний набір описів — засіюється для тенанта при першому
// відкритті панелі, якщо в нього ще немає жодного запису.
export const DEFAULT_PACKAGE_DESCRIPTIONS: string[] = [
  'Документи',
  'Одяг',
  'Взуття',
  'Електроніка',
  'Косметика',
  'Ліки',
  'Дитячі речі',
  'Продукти харчування',
  'Подарунки',
  'Побутова хімія',
  'Книги',
  'Інструменти',
];

// ================================================================
// CRUD
// ================================================================

export async function listPackageDescriptionsByTenant(
  tenantId: string,
): Promise<PackageDescription[]> {
  const { data, error } = await supabase
    .from('package_descriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PackageDescription[];
}

export async function createPackageDescription(
  tenantId: string,
  input: PackageDescriptionInput,
): Promise<PackageDescription> {
  const { data, error } = await supabase
    .from('package_descriptions')
    .insert({ ...input, tenant_id: tenantId })
    .select()
    .single();
  if (error) throw error;
  return data as PackageDescription;
}

export async function updatePackageDescription(
  tenantId: string,
  id: number,
  patch: Partial<PackageDescriptionInput>,
): Promise<PackageDescription> {
  const { data, error } = await supabase
    .from('package_descriptions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();
  if (error) throw error;
  return data as PackageDescription;
}

export async function deletePackageDescription(
  tenantId: string,
  id: number,
): Promise<void> {
  const { error } = await supabase
    .from('package_descriptions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);
  if (error) throw error;
}

// Swap sort_order with neighbour. Returns true if swap happened.
export async function swapPackageDescriptionOrder(
  tenantId: string,
  items: PackageDescription[],
  idx: number,
  direction: 'up' | 'down',
): Promise<boolean> {
  const other = direction === 'up' ? idx - 1 : idx + 1;
  if (other < 0 || other >= items.length) return false;
  const a = items[idx];
  const b = items[other];
  const tmp = -Math.abs(a.sort_order) - 1;
  await updatePackageDescription(tenantId, a.id, { sort_order: tmp });
  await updatePackageDescription(tenantId, b.id, { sort_order: a.sort_order });
  await updatePackageDescription(tenantId, a.id, { sort_order: b.sort_order });
  return true;
}

// Засіває стандартний набір описів для тенанта. Викликається з
// PackageDescriptionsPanel якщо list повернув порожній масив.
// ON CONFLICT DO NOTHING (через upsert ignoreDuplicates) гарантує безпеку
// при гонці двох клієнтів.
export async function seedDefaultPackageDescriptions(
  tenantId: string,
): Promise<void> {
  const rows = DEFAULT_PACKAGE_DESCRIPTIONS.map((text, i) => ({
    tenant_id: tenantId,
    text,
    sort_order: i + 1,
  }));
  const { error } = await supabase
    .from('package_descriptions')
    .upsert(rows, { onConflict: 'tenant_id,text', ignoreDuplicates: true });
  if (error) throw error;
}
