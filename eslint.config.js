import js from '@eslint/js';
import ts from 'typescript-eslint';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,

	{
		languageOptions: {
			globals: {
				...globals.node,
				...globals.browser,
				NodeJS: 'readonly',
				Bun: 'readonly'
			}
		},
		rules: {
			// `any` is used deliberately at the codegen/runtime boundary: emitted
			// validator sources are untyped JS, and framework middleware payloads
			// (Elysia/Hono contexts) arrive as opaque objects.
			'@typescript-eslint/no-explicit-any': 'off',
			'no-empty': ['error', { allowEmptyCatch: true }],
			'prefer-const': 'error'
		}
	},

	{
		ignores: ['dist/', 'examples/', 'bench.ts']
	}
];
