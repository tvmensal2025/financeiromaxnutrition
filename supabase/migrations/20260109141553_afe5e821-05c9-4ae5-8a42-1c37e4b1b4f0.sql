-- Backfill full_name, first_name, last_name from raw_payload for existing leads
UPDATE leads_externos
SET 
  full_name = COALESCE(
    full_name,
    raw_payload->'contact'->>'full_name',
    raw_payload->'lead'->>'full_name',
    raw_payload->>'full_name',
    NULLIF(CONCAT_WS(' ', 
      COALESCE(raw_payload->'contact'->>'first_name', raw_payload->>'first_name'),
      COALESCE(raw_payload->'contact'->>'last_name', raw_payload->>'last_name')
    ), '')
  ),
  first_name = COALESCE(
    first_name,
    raw_payload->'contact'->>'first_name',
    raw_payload->'lead'->>'first_name',
    raw_payload->>'first_name',
    SPLIT_PART(COALESCE(raw_payload->'contact'->>'full_name', raw_payload->'lead'->>'full_name', raw_payload->>'full_name'), ' ', 1)
  ),
  last_name = COALESCE(
    last_name,
    raw_payload->'contact'->>'last_name',
    raw_payload->'lead'->>'last_name',
    raw_payload->>'last_name',
    NULLIF(SUBSTRING(COALESCE(raw_payload->'contact'->>'full_name', raw_payload->'lead'->>'full_name', raw_payload->>'full_name') FROM POSITION(' ' IN COALESCE(raw_payload->'contact'->>'full_name', raw_payload->'lead'->>'full_name', raw_payload->>'full_name')) + 1), '')
  ),
  email = COALESCE(
    email,
    raw_payload->'contact'->>'email',
    raw_payload->'lead'->>'email',
    raw_payload->>'email'
  ),
  phone = COALESCE(
    phone,
    raw_payload->'contact'->>'phone',
    raw_payload->'lead'->>'phone',
    raw_payload->>'phone'
  ),
  city = COALESCE(
    city,
    raw_payload->'location'->>'city',
    raw_payload->'lead'->>'city',
    raw_payload->>'city'
  ),
  state = COALESCE(
    state,
    raw_payload->'location'->>'state',
    raw_payload->'lead'->>'state',
    raw_payload->>'state'
  )
WHERE full_name IS NULL OR first_name IS NULL;