/**
 * Framework integrations for TypKit schemas.
 *
 * ```ts
 * import { validator, validate, inputParser } from '@myrialabs/typkit/middleware';
 * ```
 *
 * Every TypKit schema is a Standard Schema, so Elysia, Hono, tRPC, react-hook-form,
 * and TanStack Form accept one with no adapter. These exports cover the cases —
 * like Hono's per-target validator — where a thin helper is still convenient.
 */

export { validator } from './hono.js';
export { validate, guard } from './elysia.js';
export { inputParser } from './trpc.js';
export { parseOrThrow, errorBody, type Validator, type Target, type ValidationErrorBody } from './shared.js';
