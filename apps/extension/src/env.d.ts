interface ImportMetaEnv {
  readonly WXT_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly WXT_SUPABASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
