const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const securityPlugin = require('eslint-plugin-security');

module.exports = tseslint.config(
  {
    ignores: ['**/*.spec.ts', 'dist/**', 'projects/**', 'coverage/**']
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  securityPlugin.configs.recommended,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-unsafe-regex': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-properties': [
        'error',
        {
          property: 'bypassSecurityTrustHtml',
          message: 'Security Warning: Bypassing HTML security can introduce XSS vulnerabilities.'
        },
        {
          property: 'bypassSecurityTrustScript',
          message: 'Security Warning: Bypassing Script security can introduce arbitrary code execution.'
        },
        {
          property: 'bypassSecurityTrustUrl',
          message: 'Security Warning: Bypassing URL security can introduce malicious redirects.'
        }
      ]
    }
  }
);
