/**
 * Scalar nodes: string, number, int, boolean, bigint, date, literal, enum, and
 * the trivial `any`/`unknown`/`null`/`undefined`. Each emits a type gate plus its
 * inline constraints, and returns its JSON Schema fragment.
 */

import { TypeNode, type Emitter } from '../compiler.js';
import type { JsonSchema } from '../json-schema.js';
import {
	emitStringConstraints,
	stringJsonSchema,
	emitNumberConstraints,
	numberJsonSchema,
	type StringOpts,
	type NumberOpts,
} from '../constraints/index.js';

export class StringNode extends TypeNode<string> {
	constructor(readonly opts: StringOpts = {}) {
		super();
	}
	override emit(e: Emitter, src: string, path: string): void {
		e.gate(`typeof ${src}!=="string"`, 'expected a string', path, () => emitStringConstraints(e, src, path, this.opts));
	}
	override jsonSchema(): JsonSchema {
		return { type: 'string', ...stringJsonSchema(this.opts) };
	}

	private with(opts: Partial<StringOpts>): StringNode {
		return new StringNode({ ...this.opts, ...opts });
	}
	/** Require at least `n` characters. */
	minLength(n: number): StringNode {
		return this.with({ minLength: n });
	}
	/** Require at most `n` characters. */
	maxLength(n: number): StringNode {
		return this.with({ maxLength: n });
	}
	/** Require exactly `n` characters. */
	length(n: number): StringNode {
		return this.with({ length: n });
	}
	/** Reject the empty string. */
	nonEmpty(): StringNode {
		return this.with({ nonEmpty: true });
	}
	/** Require a match against `re`. */
	pattern(re: RegExp): StringNode {
		return this.with({ pattern: re });
	}
	/** Restrict to a character class body, e.g. `'a-z0-9_'`. */
	charset(set: string): StringNode {
		return this.with({ charset: set });
	}
	/** Allow at most `n` lines (inline newline scan). */
	maxLines(n: number): StringNode {
		return this.with({ maxLines: n });
	}
	/** Require the string to start with `s`. */
	startsWith(s: string): StringNode {
		return this.with({ startsWith: s });
	}
	/** Require the string to end with `s`. */
	endsWith(s: string): StringNode {
		return this.with({ endsWith: s });
	}
	/** Require the string to contain `s`. */
	includes(s: string): StringNode {
		return this.with({ includes: s });
	}
	/** Reject if any blocked word appears (case-insensitive). */
	blockWords(words: string[]): StringNode {
		return this.with({ blockWords: words });
	}
	/** Require every whitespace-separated token to be allowed. */
	allowedWords(words: string[]): StringNode {
		return this.with({ allowedWords: words });
	}
	/** Reject leading/trailing whitespace (does not mutate). */
	trim(): StringNode {
		return this.with({ trim: true });
	}
	/** Apply a named format (`email`, `uuid`, `ipv4`, `creditCard`, …). */
	format(name: NonNullable<StringOpts['format']>): StringNode {
		return this.with({ format: name });
	}
	/** Require a valid email address. */
	email(): StringNode {
		return this.with({ format: 'email' });
	}
	/** Require a valid UUID. */
	uuid(): StringNode {
		return this.with({ format: 'uuid' });
	}
	/** Require a valid HTTP(S) URL. */
	url(): StringNode {
		return this.with({ format: 'url' });
	}
	/** Require a lowercase slug. */
	slug(): StringNode {
		return this.with({ format: 'slug' });
	}
}

export class NumberNode extends TypeNode<number> {
	constructor(readonly opts: NumberOpts = {}) {
		super();
	}
	override emit(e: Emitter, src: string, path: string): void {
		e.gate(`typeof ${src}!=="number"`, 'expected a number', path, () => emitNumberConstraints(e, src, path, this.opts));
	}
	override jsonSchema(): JsonSchema {
		return numberJsonSchema(this.opts) as JsonSchema;
	}

	private with(opts: Partial<NumberOpts>): NumberNode {
		return new NumberNode({ ...this.opts, ...opts });
	}
	/** Inclusive lower bound. */
	min(n: number): NumberNode {
		return this.with({ min: n });
	}
	/** Inclusive upper bound. */
	max(n: number): NumberNode {
		return this.with({ max: n });
	}
	/** Exclusive lower bound. */
	greaterThan(n: number): NumberNode {
		return this.with({ greaterThan: n });
	}
	/** Exclusive upper bound. */
	lessThan(n: number): NumberNode {
		return this.with({ lessThan: n });
	}
	/** Require a whole number. */
	integer(): NumberNode {
		return this.with({ integer: true });
	}
	/** Require divisibility by `n`. */
	multipleOf(n: number): NumberNode {
		return this.with({ multipleOf: n });
	}
	/** Require a value greater than zero. */
	positive(): NumberNode {
		return this.with({ positive: true });
	}
	/** Require a value less than zero. */
	negative(): NumberNode {
		return this.with({ negative: true });
	}
	/** Require a value of zero or more. */
	nonnegative(): NumberNode {
		return this.with({ nonnegative: true });
	}
	/** Reject `NaN`/`±Infinity` (off by default — JSON-safe). */
	finite(): NumberNode {
		return this.with({ finite: true });
	}
	/** Require a `Number.isSafeInteger` value. */
	safeInt(): NumberNode {
		return this.with({ safeInt: true });
	}
	/** Require a valid TCP/UDP port (1–65535). */
	port(): NumberNode {
		return this.with({ port: true });
	}
}

export class BooleanNode extends TypeNode<boolean> {
	override emit(e: Emitter, src: string, path: string): void {
		e.check(`typeof ${src}!=="boolean"`, 'expected a boolean', path);
	}
	override jsonSchema(): JsonSchema {
		return { type: 'boolean' };
	}
}

export class BigIntNode extends TypeNode<bigint> {
	override emit(e: Emitter, src: string, path: string): void {
		e.check(`typeof ${src}!=="bigint"`, 'expected a bigint', path);
	}
	override jsonSchema(): JsonSchema {
		return { type: 'integer', format: 'int64' };
	}
}

export class DateNode extends TypeNode<Date> {
	override emit(e: Emitter, src: string, path: string): void {
		e.check(`!(${src} instanceof Date)||isNaN(+${src})`, 'expected a valid Date', path);
	}
	override jsonSchema(): JsonSchema {
		return { type: 'string', format: 'date-time' };
	}
}

export type Literal = string | number | boolean | null;

export class LiteralNode<T extends Literal> extends TypeNode<T> {
	constructor(readonly value: T) {
		super();
	}
	override emit(e: Emitter, src: string, path: string): void {
		e.check(`${src}!==${JSON.stringify(this.value)}`, `must be ${JSON.stringify(this.value)}`, path);
	}
	override jsonSchema(): JsonSchema {
		return { const: this.value };
	}
}

export class EnumNode<T extends string | number> extends TypeNode<T> {
	constructor(readonly values: readonly T[]) {
		super();
	}
	override emit(e: Emitter, src: string, path: string): void {
		const cond = this.values.map((v) => `${src}!==${JSON.stringify(v)}`).join('&&');
		e.check(cond, `must be one of: ${this.values.join(', ')}`, path);
	}
	override jsonSchema(): JsonSchema {
		return { enum: this.values.slice() };
	}
}

export class AnyNode extends TypeNode<any> {
	override emit(): void {
		// any: no checks.
	}
	override jsonSchema(): JsonSchema {
		return {};
	}
}

export class UnknownNode extends TypeNode<unknown> {
	override emit(): void {
		// unknown: no checks.
	}
	override jsonSchema(): JsonSchema {
		return {};
	}
}

export class NullNode extends TypeNode<null> {
	override emit(e: Emitter, src: string, path: string): void {
		e.check(`${src}!==null`, 'expected null', path);
	}
	override jsonSchema(): JsonSchema {
		return { type: 'null' };
	}
}

export class UndefinedNode extends TypeNode<undefined> {
	override emit(e: Emitter, src: string, path: string): void {
		e.check(`${src}!==undefined`, 'expected undefined', path);
	}
	override jsonSchema(): JsonSchema {
		return {};
	}
}
