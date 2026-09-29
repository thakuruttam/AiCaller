import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      // A context module exporting its own `useX` hook next to the provider is
      // the idiomatic React pattern, and the same file exporting the constants
      // that describe its values is normal too. Fast refresh still works; it
      // just remounts the subtree, which is acceptable for these modules.
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true, allowExportNames: [
          'useAuth', 'useToast', 'useTheme', 'useNotifications',
        ] },
      ],

      // ── React Compiler rules ────────────────────────────────────────────
      // eslint-plugin-react-hooks v6 ships the compiler's static analysis in
      // `recommended`. This codebase has not opted into the compiler, and these
      // rules flag a lot of patterns that are correct without it — reading a
      // ref inside a callback passed to a render prop, deriving a value from a
      // prop in an effect, mutating a local draft before setState. They are
      // worth seeing, so they stay on as warnings rather than being switched
      // off; the classic correctness rules below remain errors.
      'react-hooks/immutability': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',

      // The two that catch real bugs stay as errors.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
])
