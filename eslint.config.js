// Reglas mínimas: detectar identificadores no definidos o sin uso.
// El estilo compacto del código es intencional y no se valida aquí.
import globals from 'globals';

export default [
  { ignores: ['**/node_modules/**', '**/.wrangler/**', 'apps/web/public/vendor/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    files: ['apps/web/public/js/**/*.js'],
    languageOptions: { globals: { ...globals.browser, pdfjsLib: 'readonly' } },
  },
  {
    files: ['apps/api/functions/**/*.js', 'apps/api/src/**/*.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ['apps/api/scripts/**/*.mjs', 'scripts/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
];
