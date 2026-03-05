import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const withNested = (segment) => [
  `@/src/${segment}`,
  `@/src/${segment}/**`,
  `../${segment}`,
  `../${segment}/**`,
  `../../${segment}`,
  `../../${segment}/**`,
  `../../../${segment}`,
  `../../../${segment}/**`,
  `**/${segment}`,
  `**/${segment}/**`,
];

const uiImportPatterns = [
  ...withNested('components'),
  ...withNested('pages'),
  ...withNested('context'),
  ...withNested('i18n'),
  '@/src/App',
  '@/src/main',
];

const infraImportPatterns = [...withNested('server'), '@/server', '@/server/**'];

const appImportPatterns = [...withNested('api'), ...withNested('utils')];

const ruleFor = (group, message) => [
  'error',
  {
    patterns: [
      {
        group,
        message,
      },
    ],
  },
];

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'data/**',
      '.tmp/**',
      'tmp_*.js',
      'tmp_*.html',
      'tmp_*.txt',
    ],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/types/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ruleFor(
        [...uiImportPatterns, ...appImportPatterns, ...infraImportPatterns],
        'domain 层禁止依赖 application/infra/ui 层。',
      ),
    },
  },
  {
    files: ['src/api/**/*.{ts,tsx}', 'src/utils/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ruleFor(
        [...uiImportPatterns, ...infraImportPatterns],
        'application 层禁止直接依赖 ui 或 infra 层。',
      ),
    },
  },
  {
    files: ['server/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ruleFor(
        uiImportPatterns,
        'infra 层禁止依赖 ui 层（pages/components/context/i18n）。',
      ),
    },
  },
  {
    files: [
      'src/App.tsx',
      'src/main.tsx',
      'src/pages/**/*.{ts,tsx}',
      'src/components/**/*.{ts,tsx}',
      'src/context/**/*.{ts,tsx}',
      'src/i18n/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': ruleFor(
        infraImportPatterns,
        'ui 层禁止直接依赖 infra 层，请经由 application 层访问数据。',
      ),
    },
  },
];
