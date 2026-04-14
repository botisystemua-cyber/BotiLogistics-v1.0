-- Enable 'driver' module for both existing tenants.
-- 'passenger' is baseline (always present); 'driver' is now module-gated
-- so we add it explicitly so existing driver users can keep logging in.
-- 'cargo' stays off until admin enables it per tenant.

UPDATE clients
SET    modules = '{passenger,driver}',
       updated_at = now()
WHERE  tenant_id IN ('gresco', 'express_sv_travel')
  AND  NOT (modules @> '{driver}');
