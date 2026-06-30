import { createClient } from '@supabase/supabase-js';

// Browser/public client: uses the publishable (anon) key only. Every read
// here is gated by Row Level Security (see supabase/schema.sql) - this key
// is safe to ship in the client bundle and is used by the public
// /cliente/[slug] portal.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
