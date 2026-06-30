/**
 * Elysia integration. Elysia consumes Standard Schemas natively, so a TypKit
 * schema can be passed straight into a route's `body`/`query`/`params`/`response`
 * — valid requests reach the handler, invalid ones return `422` with the issue
 * path, and `t.coerce.*` query schemas decode string params automatically.
 *
 * @example
 * ```ts
 * import { Elysia } from 'elysia';
 * import { t } from '@myrialabs/typkit';
 *
 * new Elysia().post('/users', ({ body }) => body, {
 *   body: t.object({ name: t.string({ minLength: 2 }), age: t.int({ min: 0 }) }),
 *   query: t.object({ ref: t.optional(t.string()) }),
 * });
 * ```
 *
 * The helpers below are conveniences for handlers that validate explicitly (for
 * example inside a `derive`) rather than through the route schema.
 */

import type { Validator } from './shared.js';
import { parseOrThrow } from './shared.js';

/**
 * Validate a value with a TypKit schema inside an Elysia handler, returning the
 * typed (and coerced) value or throwing — Elysia maps the throw to a `422`.
 */
export function validate<T>(schema: Validator<T>, value: unknown): T {
	return parseOrThrow(schema, value);
}

/**
 * Build an Elysia `onBeforeHandle` hook that validates one context `target`
 * (`'body'`/`'query'`/`'params'`/`'headers'`) and assigns the coerced value back,
 * for cases where you want explicit control instead of the route schema.
 */
export function guard<T>(target: 'body' | 'query' | 'params' | 'headers', schema: Validator<T>) {
	return (ctx: any): void => {
		ctx[target] = parseOrThrow(schema, ctx[target]);
	};
}
