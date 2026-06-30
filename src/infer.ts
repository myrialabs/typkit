/**
 * Type-level inference helpers. `Infer<S>` reads the phantom `_output` carried by
 * every node; the object node composes these, turning optional members into `?`
 * properties so the inferred type matches the validated shape exactly.
 */

import type { TypeNode } from './compiler.js';

/** Flatten an intersection into a single, readable object type. */
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

/** Marks nodes whose object key should be optional (`optional` / `default`). */
export interface OptionalMarker {
	readonly _optional: true;
}

/** Extract the inferred output type of a schema node. */
export type Infer<S> = S extends TypeNode<infer T> ? T : never;

type OptionalKeys<S> = { [K in keyof S]: S[K] extends OptionalMarker ? K : never }[keyof S];
type RequiredKeys<S> = { [K in keyof S]: S[K] extends OptionalMarker ? never : K }[keyof S];

/** Infer an object output type from a shape, honoring optional members. */
export type InferObject<S extends Record<string, TypeNode>> = Prettify<
	{ [K in RequiredKeys<S>]: Infer<S[K]> } & { [K in OptionalKeys<S>]?: Infer<S[K]> }
>;

/** Infer a tuple output type from a list of element nodes. */
export type InferTuple<T extends readonly TypeNode[]> = { -readonly [K in keyof T]: Infer<T[K]> };
