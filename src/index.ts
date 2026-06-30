/**
 * TypKit — fast TypeScript schema validation.
 *
 * Schemas are built by chaining constraints (or with an equivalent config object)
 * and compiled once into a single monomorphic validator via `new Function`. The
 * happy path allocates nothing; rich constraints (`maxLines`, `charset`,
 * `blockWords`, formats, ranges) compile to inline code. Every schema implements
 * Standard Schema and exports JSON Schema.
 *
 * @example
 * ```ts
 * import { t } from '@myrialabs/typkit';
 *
 * const Comment = t.object({
 *   author: t.string().minLength(3).maxLength(20).charset('a-z0-9_'),
 *   email: t.string().email(),
 *   body: t.string().nonEmpty().maxLines(500),
 *   rating: t.int().min(1).max(5),
 * });
 *
 * Comment.check(value);                  // boolean (zero-alloc)
 * Comment.assert(value);                 // throws on failure, returns typed value
 * Comment.parse(value);                  // { value } | { issues }
 * Comment['~standard'].validate(value);  // Standard Schema
 * Comment.toJsonSchema();                // OpenAPI / JSON Schema
 * type Comment = t.infer<typeof Comment>;
 * ```
 */

export { t } from './typkit.js';
export { TypeNode, type ParseOptions } from './compiler.js';
export { TypkitError, formatPath, type Issue, type ParseResult } from './errors.js';
export type { JsonSchema } from './json-schema.js';
export { type StandardSchemaV1 } from './standard-schema.js';
export type { Infer, InferObject, Prettify } from './infer.js';
export type { StringOpts, NumberOpts, ArrayOpts } from './constraints/index.js';
export type { FormatName } from './formats.js';
