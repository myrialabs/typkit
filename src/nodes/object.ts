/**
 * Object node with the usual algebra: `partial` / `pick` / `omit` / `extend` /
 * `strict` / `passthrough`. Properties are validated inline; a property's path is
 * built only when that property fails. Unknown-key policy is `strip` by default
 * (extra keys ignored), `strict` (reject), or `passthrough` (no effect on checks).
 */

import { TypeNode, type Emitter } from '../compiler.js';
import type { JsonSchema } from '../json-schema.js';
import type { InferObject, Prettify } from '../infer.js';

type Shape = Record<string, TypeNode>;
type Mode = 'strip' | 'strict' | 'passthrough';

const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function access(src: string, key: string): string {
	return IDENT.test(key) ? `${src}.${key}` : `${src}[${JSON.stringify(key)}]`;
}

export class ObjectNode<S extends Shape> extends TypeNode<InferObject<S>> {
	constructor(
		readonly shape: S,
		readonly mode: Mode = 'strip',
	) {
		super();
	}

	override emit(e: Emitter, src: string, path: string): void {
		e.gate(`typeof ${src}!=="object"||${src}===null||Array.isArray(${src})`, 'expected an object', path, () => this.emitFields(e, src, path));
	}

	/**
	 * Emit only the property checks, assuming `src` is already known to be a plain
	 * object. `skip` omits a property whose value is already established (used by
	 * the discriminated union, which has matched the tag via its `switch`).
	 */
	emitFields(e: Emitter, src: string, path: string, skip?: string): void {
		const keys = Object.keys(this.shape);
		if (this.mode === 'strict') {
			const known = e.ref(new Set(keys));
			const k = e.freshVar();
			e.line(`for(var ${k} in ${src}){if(!${known}.has(${k})){${e.fail('unexpected property', `${path}.concat([${k}])`)}}}`);
		}
		for (const key of keys) {
			if (key === skip) continue;
			const child = this.shape[key]!;
			const v = e.freshVar();
			const childPath = `${path}.concat([${JSON.stringify(key)}])`;
			e.line(`var ${v}=${access(src, key)};`);
			if (child.isOptional) {
				e.line(`if(${v}!==undefined){`);
				child.emit(e, v, childPath);
				e.line('}');
			} else {
				child.emit(e, v, childPath);
			}
		}
	}

	override hasTransform(): boolean {
		for (const key of Object.keys(this.shape)) if (this.shape[key]!.hasTransform()) return true;
		return false;
	}

	override transform(e: Emitter, src: string): string {
		const parts: string[] = [];
		for (const key of Object.keys(this.shape)) {
			const child = this.shape[key]!;
			if (!child.hasTransform()) continue;
			parts.push(`${JSON.stringify(key)}:${child.transform(e, access(src, key))}`);
		}
		return parts.length ? `Object.assign({},${src},{${parts.join(',')}})` : src;
	}

	override jsonSchema(): JsonSchema {
		const properties: Record<string, JsonSchema> = {};
		const required: string[] = [];
		for (const key of Object.keys(this.shape)) {
			const child = this.shape[key]!;
			properties[key] = child.jsonSchema();
			if (!child.isOptional) required.push(key);
		}
		const out: JsonSchema = { type: 'object', properties };
		if (required.length) out.required = required;
		if (this.mode === 'strict') out.additionalProperties = false;
		if (this.mode === 'passthrough') out.additionalProperties = true;
		return out;
	}

	/** Make every property optional. */
	partial(): ObjectNode<{ [K in keyof S]: TypeNode<S[K]['_output'] | undefined> }> {
		const next: Shape = {};
		for (const key of Object.keys(this.shape)) {
			const child = this.shape[key]!;
			const clone = Object.create(Object.getPrototypeOf(child));
			Object.assign(clone, child);
			clone.isOptional = true;
			next[key] = clone;
		}
		return new ObjectNode(next, this.mode) as any;
	}

	/** Keep only the named properties. */
	pick<K extends keyof S>(keys: readonly K[]): ObjectNode<Prettify<Pick<S, K>>> {
		const next: Shape = {};
		for (const key of keys as readonly string[]) if (key in this.shape) next[key] = this.shape[key]!;
		return new ObjectNode(next, this.mode) as any;
	}

	/** Drop the named properties. */
	omit<K extends keyof S>(keys: readonly K[]): ObjectNode<Prettify<Omit<S, K>>> {
		const drop = new Set(keys as readonly string[]);
		const next: Shape = {};
		for (const key of Object.keys(this.shape)) if (!drop.has(key)) next[key] = this.shape[key]!;
		return new ObjectNode(next, this.mode) as any;
	}

	/** Merge in (and override with) another shape. */
	extend<E extends Shape>(shape: E): ObjectNode<Prettify<Omit<S, keyof E> & E>> {
		return new ObjectNode({ ...this.shape, ...shape }, this.mode) as any;
	}

	/** Reject unknown keys. */
	strict(): ObjectNode<S> {
		return new ObjectNode(this.shape, 'strict');
	}

	/** Allow unknown keys (documented in JSON Schema as `additionalProperties: true`). */
	passthrough(): ObjectNode<S> {
		return new ObjectNode(this.shape, 'passthrough');
	}
}
