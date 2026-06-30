/**
 * Issue shape and error type shared across the public surface. Paths are built
 * only on the failure branch of a compiled validator, so the happy path never
 * allocates a path array.
 */

/** A single validation problem, Standard-Schema-shaped. */
export interface Issue {
	/** Human-readable description of what went wrong. */
	readonly message: string;
	/** Property path from the validated root to the offending value. */
	readonly path: ReadonlyArray<PropertyKey>;
}

/** Success carries the (possibly coerced) value; failure carries the issues. */
export type ParseResult<T> =
	| { readonly value: T; readonly issues?: undefined }
	| { readonly value?: undefined; readonly issues: readonly Issue[] };

/** Internal error record emitted by compiled validators. */
export interface RawIssue {
	m: string;
	p: PropertyKey[];
}

/** Render a property path as a slash-delimited pointer, e.g. `/items/0/name`. */
export function formatPath(path: ReadonlyArray<PropertyKey>): string {
	return path.length === 0 ? '<root>' : '/' + path.map(String).join('/');
}

/** Thrown by `assert()` when validation fails. Carries every collected issue. */
export class TypkitError extends Error {
	readonly issues: readonly Issue[];

	constructor(issues: readonly Issue[]) {
		const first = issues[0];
		super(first ? `${first.message} at ${formatPath(first.path)}` : 'validation failed');
		this.name = 'TypkitError';
		this.issues = issues;
	}
}

/** Convert a raw codegen issue into the public {@link Issue} shape. */
export function toIssue(raw: RawIssue): Issue {
	return { message: raw.m, path: raw.p };
}
