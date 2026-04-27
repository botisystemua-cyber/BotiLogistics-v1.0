// React-хук для Supabase Realtime: одноразова підписка на postgres_changes
// для конкретної таблиці поточного tenant'а. При івенті викликає `onChange`
// з debounce (800мс) — щоб серія UPDATE'ів від bulk-операції менеджера не
// штормила refetch'и.
//
// Використання:
//   useRealtimeTable('routes', (payload) => {
//     if (payload.new?.status === 'cancelled') showToast('Рейс відмінено');
//     refresh();
//   });

import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { readSession } from './session';

type AnyRow = { [key: string]: unknown };
export type RtPayload = RealtimePostgresChangesPayload<AnyRow>;

export function useRealtimeTable(
  table: 'packages' | 'routes' | 'passengers',
  onChange: (payload: RtPayload) => void,
) {
  const cbRef = useRef(onChange);
  // sync callback в окремому ефекті — щоб не порушувати react-refs rules
  // (запис у .current під час render заборонений лінтером).
  useEffect(() => { cbRef.current = onChange; }, [onChange]);

  useEffect(() => {
    const sess = readSession();
    if (!sess?.tenant_id) return;
    const tenantId = sess.tenant_id;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastPayload: RtPayload | null = null;
    function debounced(payload: RtPayload) {
      lastPayload = payload;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (lastPayload) cbRef.current(lastPayload);
      }, 800);
    }

    const ch = supabase
      .channel(`drv-rt-${table}-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `tenant_id=eq.${tenantId}` },
        (payload) => debounced(payload as RtPayload),
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(ch);
    };
  }, [table]);
}
