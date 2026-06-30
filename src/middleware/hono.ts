/**
 * Hono validator middleware. Validates one request target with a TypKit schema,
 * exposes the typed (and coerced) value via `c.req.valid(target)`, and replies
 * `400` with the collected issues on failure.
 *
 * @example
 * ```ts
 * import { Hono } from 'hono';
 * import { t } from '@myrialabs/typkit';
 * import { validator } from '@myrialabs/typkit/middleware';
 *
 * const app = new Hono();
 * app.post('/users', validator('json', t.object({ name: t.string({ minLength: 2 }) })),
 *   (c) => c.json(c.req.valid('json')));
 * ```
 *
 * Since TypKit schemas are Standard Schemas, `@hono/standard-validator` works too;
 * this adapter ships in-package so no extra dependency is required.
 */

import type { Validator, Target } from './shared.js';
import { errorBody } from './shared.js';

/** Create a Hono validator middleware for one request `target`. */
export function validator<T>(target: Target, schema: Validator<T>) {
	return async (c: any, next: () => Promise<void>): Promise<Response | undefined> => {
		let value: unknown;
		switch (target) {
			case 'json':
				value = await c.req.json().catch(() => undefined);
				break;
			case 'form':
				value = await c.req.parseBody();
				break;
			case 'query':
				value = c.req.query();
				break;
			case 'param':
				value = c.req.param();
				break;
			case 'header':
				value = Object.fromEntries(c.req.raw.headers);
				break;
			case 'cookie':
				value = c.req.cookie ? c.req.cookie() : {};
				break;
		}

		const result = schema.parse(value, { abortEarly: false });
		if (result.issues) return c.json(errorBody(result.issues, target), 400);
		c.req.addValidatedData(target, result.value as object);
		await next();
		return undefined;
	};
}
