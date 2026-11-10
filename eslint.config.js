import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'backend/node_modules', '.tts-venv'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  // Backend, scripts y archivos de configuración se ejecutan en Node (no en el navegador)
  {
    files: ['backend/**/*.js', 'scripts/**/*.js', '*.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },
  // mongo-init.js lo ejecuta la shell de MongoDB, que aporta `db`
  {
    files: ['backend/mongo-init.js'],
    languageOptions: { globals: { db: 'readonly' } },
  },
]
