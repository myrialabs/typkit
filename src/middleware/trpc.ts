/**
 * tRPC integration. tRPC v11 accepts any Standard Schema as an input/output
 * parser, so a TypKit schema works directly:
 *
 * @example
 * ```ts
 * import { initTRPC } from '@trpc/server';
 * import { t as k } from '@myrialabs/typkit';
 *
 * const t = initTRPC.create();
 * export const appRouter = t.router({
 *   createUser: t.procedure
 *     .input(k.object({ name: k.string({ minLength: 2 }), age: k.int({ min: 0 }) }))
 *     .mutation(({ input }) => input), // `input` is fully typed
 * });
 * ```
 *
 * `inputParser` is an explicit, typed pass-through for readers who prefer to name
 * the integration point; it simply returns the schema unchanged.
 */

import type { Validator } from './shared.js';

/** Identity helper that documents a schema's use as a tRPC input/output parser. */
export function inputParser<T>(schema: Validator<T>): Validator<T> {
	return schema;
}
