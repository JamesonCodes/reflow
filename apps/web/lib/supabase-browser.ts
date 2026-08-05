import { browserEnvironmentSchema, type Database } from '@reflow/contracts';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient<Database> | undefined;

export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (browserClient) return browserClient;

  const environment = browserEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  if (!environment.success) return null;

  browserClient = createClient<Database>(
    environment.data.NEXT_PUBLIC_SUPABASE_URL,
    environment.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
      },
    },
  );

  return browserClient;
}
