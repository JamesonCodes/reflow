import { adminEnvironmentSchema, type Database } from '@reflow/contracts';
import { createClient } from '@supabase/supabase-js';

function getAdminEnvironment() {
  return adminEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    REFLOW_ADMIN_EMAILS: process.env.REFLOW_ADMIN_EMAILS,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}

export function createSupabaseAdminClient() {
  const environment = getAdminEnvironment();

  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

export function getAdminEmailAllowlist() {
  return new Set(
    getAdminEnvironment()
      .REFLOW_ADMIN_EMAILS.split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
