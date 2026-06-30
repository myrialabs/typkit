/**
 * Shared helpers for the framework adapters. Because every TypKit schema is a
 * Standard Schema, most frameworks accept one directly; these helpers cover the
 * cases where a thin adapter (manual validation + error shaping) is still needed.
 */

import type { TypeNode } from '../compiler.js';
import type { Issue } from '../errors.js';
import { TypkitError } from '../errors.js';

/** The subset of a schema the adapters rely on. */
export type Validator<T> = Pick<TypeNode<T>, 'parse' | 'check' | 'assert'>;

/** Where in a request a value is read from. */
export type Target = 'json' | 'form' | 'query' | 'param' | 'header' | 'cookie';

/** Shape returned to clients on a validation failure. */
export interface ValidationErrorBody {
	readonly type: 'validation';
	readonly target?: Target;
	readonly issues: readonly Issue[];
}

/** Build the standard error body for a failed request validation. */
export function errorBody(issues: readonly Issue[], target?: Target): ValidationErrorBody {
	return { type: 'validation', target, issues };
}

/**
 * Validate `value`, collecting every issue. Returns the typed (and coerced) value
 * or throws a {@link TypkitError}. Useful in handlers that prefer exceptions.
 */
export function parseOrThrow<T>(schema: Validator<T>, value: unknown): T {
	const result = schema.parse(value, { abortEarly: false });
	if (result.issues) throw new TypkitError(result.issues);
	return result.value;
}
