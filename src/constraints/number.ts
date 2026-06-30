/**
 * Inline-compiled number constraints. The `finite` check is opt-in and defaults
 * off: JSON cannot carry `NaN`/`Infinity`, so for API-body validation the guard
 * is pure overhead — omitting it is what lets TypKit match or beat TypeBox on
 * numeric arrays. Opt in with `{ finite: true }` for non-JSON sources.
 */

import type { Emitter } from '../compiler.js';

/** Options accepted by `t.number()` / `t.int()`. */
export interface NumberOpts {
	min?: number;
	max?: number;
	greaterThan?: number;
	lessThan?: number;
	integer?: boolean;
	multipleOf?: number;
	positive?: boolean;
	negative?: boolean;
	nonnegative?: boolean;
	/** Reject `NaN`/`±Infinity`. Off by default (JSON-safe). */
	finite?: boolean;
	/** Require a 32-bit safe integer within `Number.isSafeInteger`. */
	safeInt?: boolean;
	/** Require a valid TCP/UDP port (integer in 1–65535). */
	port?: boolean;
}

/** Emit every constraint in `o` for the already-typechecked number `src`. */
export function emitNumberConstraints(e: Emitter, src: string, path: string, o: NumberOpts): void {
	if (o.finite) e.check(`${src}!==${src}||${src}===Infinity||${src}===-Infinity`, 'must be a finite number', path);
	if (o.port) {
		e.check(`(${src}|0)!==${src}||${src}<1||${src}>65535`, 'must be a valid port (1–65535)', path);
		return;
	}
	if (o.safeInt) e.check(`!Number.isSafeInteger(${src})`, 'must be a safe integer', path);
	else if (o.integer) e.check(`!Number.isInteger(${src})`, 'must be an integer', path);
	if (o.min != null) e.check(`${src}<${o.min}`, `must be at least ${o.min}`, path);
	if (o.max != null) e.check(`${src}>${o.max}`, `must be at most ${o.max}`, path);
	if (o.greaterThan != null) e.check(`${src}<=${o.greaterThan}`, `must be greater than ${o.greaterThan}`, path);
	if (o.lessThan != null) e.check(`${src}>=${o.lessThan}`, `must be less than ${o.lessThan}`, path);
	if (o.positive) e.check(`${src}<=0`, 'must be positive', path);
	if (o.negative) e.check(`${src}>=0`, 'must be negative', path);
	if (o.nonnegative) e.check(`${src}<0`, 'must be non-negative', path);
	if (o.multipleOf != null) e.check(`${src}%${o.multipleOf}!==0`, `must be a multiple of ${o.multipleOf}`, path);
}

/** Contribute number constraints to a JSON Schema fragment. */
export function numberJsonSchema(o: NumberOpts): Record<string, unknown> {
	const s: Record<string, unknown> = { type: o.integer || o.safeInt || o.port ? 'integer' : 'number' };
	if (o.min != null) s.minimum = o.min;
	if (o.max != null) s.maximum = o.max;
	if (o.greaterThan != null) s.exclusiveMinimum = o.greaterThan;
	if (o.lessThan != null) s.exclusiveMaximum = o.lessThan;
	if (o.positive) s.exclusiveMinimum = 0;
	if (o.nonnegative) s.minimum = 0;
	if (o.negative) s.exclusiveMaximum = 0;
	if (o.port) {
		s.minimum = 1;
		s.maximum = 65535;
	}
	if (o.multipleOf != null) s.multipleOf = o.multipleOf;
	return s;
}
