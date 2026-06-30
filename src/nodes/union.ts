/**
 * Union, discriminated union, and intersection.
 *
 * A discriminated union dispatches on its tag in O(1) via a `switch`, instead of
 * trying members one by one — the hot path for streaming/tagged messages. A plain
 * union compiles each member to a boolean helper and short-circuits on the first
 * match. Intersection runs each member's checks against the same value.
 */

import { TypeNode, type Emitter } from '../compiler.js';
import type { JsonSchema } from '../json-schema.js';
import type { Infer } from '../infer.js';
import { LiteralNode } from './scalars.js';
import { ObjectNode } from './object.js';

type UnionOut<T extends readonly TypeNode[]> = Infer<T[number]>;

export class UnionNode<T extends readonly TypeNode[]> extends TypeNode<UnionOut<T>> {
	constructor(readonly options: T) {
		super();
	}

	override emit(e: Emitter, src: string, path: string): void {
		const ok = e.freshVar();
		e.line(`var ${ok}=0;`);
		for (const opt of this.options) {
			const helper = e.getHelper(opt);
			e.line(`if(!${ok}&&${helper}(R,${src})===0)${ok}=1;`);
		}
		e.check(`!${ok}`, 'does not match any union member', path);
	}

	override jsonSchema(): JsonSchema {
		return { anyOf: this.options.map((o) => o.jsonSchema()) };
	}
}

export class DiscriminatedUnionNode<K extends string, T extends readonly ObjectNode<any>[]> extends TypeNode<Infer<T[number]>> {
	constructor(
		readonly key: K,
		readonly options: T,
	) {
		super();
	}

	override emit(e: Emitter, src: string, path: string): void {
		e.gate(`typeof ${src}!=="object"||${src}===null||Array.isArray(${src})`, 'expected an object', path, () => {
			const tag = e.freshVar();
			const keyAccess = JSON.stringify(this.key);
			e.line(`var ${tag}=${src}[${keyAccess}];`);
			e.line(`switch(${tag}){`);
			for (const opt of this.options) {
				const disc = opt.shape[this.key];
				const value = disc instanceof LiteralNode ? disc.value : undefined;
				e.line(`case ${JSON.stringify(value)}:{`);
				// The object type and the tag are already established by the gate and
				// the switch, so validate only the remaining fields.
				opt.emitFields(e, src, path, this.key);
				e.line('break;}');
			}
			e.line(`default:{${e.fail(`invalid value for discriminator "${this.key}"`, `${path}.concat([${keyAccess}])`)}}`);
			e.line('}');
		});
	}

	override hasTransform(): boolean {
		return this.options.some((o) => o.hasTransform());
	}

	override jsonSchema(): JsonSchema {
		return { oneOf: this.options.map((o) => o.jsonSchema()) };
	}
}

export class IntersectionNode<A extends TypeNode, B extends TypeNode> extends TypeNode<Infer<A> & Infer<B>> {
	constructor(
		readonly left: A,
		readonly right: B,
	) {
		super();
	}

	override emit(e: Emitter, src: string, path: string): void {
		this.left.emit(e, src, path);
		this.right.emit(e, src, path);
	}

	override jsonSchema(): JsonSchema {
		return { allOf: [this.left.jsonSchema(), this.right.jsonSchema()] };
	}
}
