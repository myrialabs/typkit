/**
 * Array, tuple, and record nodes. Array iterates its element validator inline;
 * the optional uniqueness check uses a `Set` (best for primitive elements).
 */

import { TypeNode, reg, type Emitter } from '../compiler.js';
import type { JsonSchema } from '../json-schema.js';
import type { Infer, InferTuple } from '../infer.js';
import { emitArrayConstraints, arrayJsonSchema, type ArrayOpts } from '../constraints/index.js';

export class ArrayNode<E extends TypeNode> extends TypeNode<Infer<E>[]> {
	constructor(
		readonly element: E,
		readonly opts: ArrayOpts = {},
	) {
		super();
	}

	override emit(e: Emitter, src: string, path: string): void {
		e.gate(`!Array.isArray(${src})`, 'expected an array', path, () => {
			emitArrayConstraints(e, src, path, this.opts);
			const i = e.freshVar();
			const el = e.freshVar();
			e.line(`for(var ${i}=0;${i}<${src}.length;${i}++){`);
			e.line(`var ${el}=${src}[${i}];`);
			this.element.emit(e, el, `${path}.concat([${i}])`);
			e.line('}');
			if (this.opts.unique) e.check(`new Set(${src}).size!==${src}.length`, 'must not contain duplicate items', path);
		});
	}

	override hasTransform(): boolean {
		return this.element.hasTransform();
	}

	override transform(e: Emitter, src: string): string {
		if (!this.element.hasTransform()) return src;
		const x = e.freshVar();
		return `${src}.map(function(${x}){return ${this.element.transform(e, x)};})`;
	}

	override jsonSchema(): JsonSchema {
		return { type: 'array', items: this.element.jsonSchema(), ...arrayJsonSchema(this.opts) };
	}

	private with(opts: Partial<ArrayOpts>): ArrayNode<E> {
		return new ArrayNode(this.element, { ...this.opts, ...opts });
	}
	/** Require at least `n` items. */
	minItems(n: number): ArrayNode<E> {
		return this.with({ minItems: n });
	}
	/** Require at most `n` items. */
	maxItems(n: number): ArrayNode<E> {
		return this.with({ maxItems: n });
	}
	/** Require exactly `n` items. */
	length(n: number): ArrayNode<E> {
		return this.with({ length: n });
	}
	/** Reject an empty array. */
	nonEmpty(): ArrayNode<E> {
		return this.with({ nonEmpty: true });
	}
	/** Reject duplicate items (by value; best for primitives). */
	unique(): ArrayNode<E> {
		return this.with({ unique: true });
	}
}

export class TupleNode<T extends readonly TypeNode[]> extends TypeNode<InferTuple<T>> {
	constructor(readonly items: T) {
		super();
	}

	override emit(e: Emitter, src: string, path: string): void {
		e.gate(`!Array.isArray(${src})`, 'expected a tuple', path, () => {
			e.check(`${src}.length!==${this.items.length}`, `must have exactly ${this.items.length} items`, path);
			this.items.forEach((item, i) => {
				const el = e.freshVar();
				e.line(`var ${el}=${src}[${i}];`);
				item.emit(e, el, `${path}.concat([${i}])`);
			});
		});
	}

	override hasTransform(): boolean {
		return this.items.some((i) => i.hasTransform());
	}

	override transform(e: Emitter, src: string): string {
		if (!this.hasTransform()) return src;
		const parts = this.items.map((item, i) => (item.hasTransform() ? item.transform(e, `${src}[${i}]`) : `${src}[${i}]`));
		return `[${parts.join(',')}]`;
	}

	override jsonSchema(): JsonSchema {
		return {
			type: 'array',
			items: this.items.map((i) => i.jsonSchema()),
			minItems: this.items.length,
			maxItems: this.items.length,
		};
	}
}

export class RecordNode<V extends TypeNode> extends TypeNode<Record<string, Infer<V>>> {
	constructor(
		readonly value: V,
		readonly keyPattern?: RegExp,
	) {
		super();
	}

	override emit(e: Emitter, src: string, path: string): void {
		e.gate(`typeof ${src}!=="object"||${src}===null||Array.isArray(${src})`, 'expected an object', path, () => {
			const k = e.freshVar();
			const val = e.freshVar();
			e.line(`for(var ${k} in ${src}){`);
			if (this.keyPattern) e.check(`!${e.ref(this.keyPattern)}.test(${k})`, 'invalid key', `${path}.concat([${k}])`);
			e.line(`var ${val}=${src}[${k}];`);
			this.value.emit(e, val, `${path}.concat([${k}])`);
			e.line('}');
		});
	}

	override hasTransform(): boolean {
		return this.value.hasTransform();
	}

	override transform(e: Emitter, src: string): string {
		if (!this.value.hasTransform()) return src;
		const kv = e.freshVar();
		return `Object.fromEntries(Object.entries(${src}).map(function(${kv}){return [${kv}[0],${this.value.transform(e, `${kv}[1]`)}];}))`;
	}

	override jsonSchema(): JsonSchema {
		return { type: 'object', additionalProperties: this.value.jsonSchema() };
	}
}

// Inject the array constructor used by the base-class `.array()` chain method.
reg.Array = ArrayNode;
