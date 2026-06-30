import 'server-only';
import { createClient } from '@supabase/supabase-js';

// Service-role client: uses the secret key, which bypasses Row Level
// Security. Only ever imported by app/api/admin/* route handlers. The
// `server-only` import makes any accidental client-side import a build
// error instead of a leaked secret.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);
