/**
 * Inline-compiled array constraints (length bounds). Element validation and the
 * optional uniqueness check live in the array node, which owns the iteration.
 */

import type { Emitter } from '../compiler.js';

/** Options accepted by `t.array()`. */
export interface ArrayOpts {
	minItems?: number;
	maxItems?: number;
	length?: number;
	nonEmpty?: boolean;
	/** Reject duplicate items. Compares by value via a `Set` (best for primitives). */
	unique?: boolean;
}

/** Emit length-bound constraints for the already-typechecked array `src`. */
export function emitArrayConstraints(e: Emitter, src: string, path: string, o: ArrayOpts): void {
	if (o.nonEmpty) e.check(`${src}.length===0`, 'must not be empty', path);
	if (o.minItems != null) e.check(`${src}.length<${o.minItems}`, `must have at least ${o.minItems} items`, path);
	if (o.maxItems != null) e.check(`${src}.length>${o.maxItems}`, `must have at most ${o.maxItems} items`, path);
	if (o.length != null) e.check(`${src}.length!==${o.length}`, `must have exactly ${o.length} items`, path);
}

/** Contribute array constraints to a JSON Schema fragment. */
export function arrayJsonSchema(o: ArrayOpts): Record<string, unknown> {
	const s: Record<string, unknown> = {};
	if (o.minItems != null) s.minItems = o.minItems;
	if (o.nonEmpty) s.minItems = Math.max(1, (s.minItems as number) ?? 1);
	if (o.maxItems != null) s.maxItems = o.maxItems;
	if (o.length != null) {
		s.minItems = o.length;
		s.maxItems = o.length;
	}
	if (o.unique) s.uniqueItems = true;
	return s;
}
