/**
 * Coercion nodes for query/path parameters, where values arrive as strings.
 * Validation checks that the raw input is coercible (and that target constraints
 * hold on the coerced value); the transform pass produces the coerced value for
 * `parse`/`assert`. `check` stays boolean, so coercion never breaks the contract.
 */

import { TypeNode, type Emitter } from './compiler.js';
import type { JsonSchema } from './json-schema.js';
import { emitNumberConstraints, numberJsonSchema, type NumberOpts } from './constraints/index.js';

export class CoerceNumberNode extends TypeNode<number> {
	constructor(readonly opts: NumberOpts = {}) {
		super();
	}
	override emit(e: Emitter, src: string, path: string): void {
		const c = e.freshVar();
		e.line(`var ${c}=Number(${src});`);
		e.gate(`typeof ${src}==="object"||${src}===""||${src}==null||${c}!==${c}`, 'expected a number-like value', path, () =>
			emitNumberConstraints(e, c, path, this.opts),
		);
	}
	override hasTransform(): boolean {
		return true;
	}
	override transform(_e: Emitter, src: string): string {
		return `Number(${src})`;
	}
	override jsonSchema(): JsonSchema {
		return numberJsonSchema(this.opts) as JsonSchema;
	}

	private with(opts: Partial<NumberOpts>): CoerceNumberNode {
		return new CoerceNumberNode({ ...this.opts, ...opts });
	}
	/** Inclusive lower bound on the coerced number. */
	min(n: number): CoerceNumberNode {
		return this.with({ min: n });
	}
	/** Inclusive upper bound on the coerced number. */
	max(n: number): CoerceNumberNode {
		return this.with({ max: n });
	}
	/** Require the coerced number to be an integer. */
	integer(): CoerceNumberNode {
		return this.with({ integer: true });
	}
}

export class CoerceBooleanNode extends TypeNode<boolean> {
	override emit(e: Emitter, src: string, path: string): void {
		e.check(
			`!(${src}===true||${src}===false||${src}==="true"||${src}==="false"||${src}==="1"||${src}==="0"||${src}===1||${src}===0)`,
			'expected a boolean-like value',
			path,
		);
	}
	override hasTransform(): boolean {
		return true;
	}
	override transform(_e: Emitter, src: string): string {
		return `(${src}===true||${src}==="true"||${src}==="1"||${src}===1)`;
	}
	override jsonSchema(): JsonSchema {
		return { type: 'boolean' };
	}
}

export class CoerceDateNode extends TypeNode<Date> {
	override emit(e: Emitter, src: string, path: string): void {
		const c = e.freshVar();
		e.line(`var ${c}=${src} instanceof Date?${src}:new Date(${src});`);
		e.check(`${src}==null||isNaN(+${c})`, 'expected a date-like value', path);
	}
	override hasTransform(): boolean {
		return true;
	}
	override transform(_e: Emitter, src: string): string {
		return `(${src} instanceof Date?${src}:new Date(${src}))`;
	}
	override jsonSchema(): JsonSchema {
		return { type: 'string', format: 'date-time' };
	}
}
