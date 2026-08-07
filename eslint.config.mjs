import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.agents/**',
      '**/.next/**',
      '**/.output/**',
      '**/.wxt/**',
      '**/coverage/**',
      '**/dist/**',
      '**/node_modules/**',
      'packages/contracts/src/database.types.ts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
    },
  },
  {
    files: ['**/*.config.{js,mjs,ts}', '**/*.d.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
