import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  dev: {
    server: {
      port: 3010,
      strictPort: true,
    },
  },
  manifest: {
    name: 'Reflow Observer',
    description:
      'Privacy-safe browser observation for explicit Reflow process studies.',
    version: '0.0.0',
    permissions: ['alarms', 'scripting', 'storage', 'tabs'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    host_permissions: ['https://*.supabase.co/*'],
    incognito: 'not_allowed',
  },
  vite: () => ({
    envDir: '../..',
  }),
  hooks: {
    'build:manifestGenerated': (_wxt, manifest) => {
      // Runtime content scripts must use only permissions granted during the
      // explicit start gesture. WXT otherwise promotes their broad match set.
      manifest.host_permissions = (manifest.host_permissions ?? []).filter(
        (permission: string) => permission.includes('supabase.co'),
      );
    },
  },
});
