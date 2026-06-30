/**
 * Modifier nodes: optional, nullable, default, and lazy (recursive). Optional and
 * default carry the {@link OptionalMarker} so the object node turns their key into
 * a `?` property. Lazy compiles its target as a memoized helper function, which is
 * what makes self-referential (recursive) schemas terminate.
 */

import { TypeNode, reg, type Emitter } from '../compiler.js';
import type { JsonSchema } from '../json-schema.js';
import type { Infer, OptionalMarker } from '../infer.js';

export class OptionalNode<E extends TypeNode> extends TypeNode<Infer<E> | undefined> implements OptionalMarker {
	declare readonly _optional: true;
	constructor(readonly inner: E) {
		super();
		this.isOptional = true;
	}
	override emit(e: Emitter, src: string, path: string): void {
		// The object node guards the `undefined` case; standalone, undefined is valid.
		e.line(`if(${src}!==undefined){`);
		this.inner.emit(e, src, path);
		e.line('}');
	}
	override hasTransform(): boolean {
		return this.inner.hasTransform();
	}
	override transform(e: Emitter, src: string): string {
		return this.inner.transform(e, src);
	}
	override jsonSchema(): JsonSchema {
		return this.inner.jsonSchema();
	}
}

export class NullableNode<E extends TypeNode> extends TypeNode<Infer<E> | null> {
	constructor(readonly inner: E) {
		super();
	}
	override emit(e: Emitter, src: string, path: string): void {
		e.line(`if(${src}!==null){`);
		this.inner.emit(e, src, path);
		e.line('}');
	}
	override hasTransform(): boolean {
		return this.inner.hasTransform();
	}
	override transform(e: Emitter, src: string): string {
		if (!this.inner.hasTransform()) return src;
		return `(${src}===null?null:${this.inner.transform(e, src)})`;
	}
	override jsonSchema(): JsonSchema {
		const inner = this.inner.jsonSchema();
		return { anyOf: [inner, { type: 'null' }] };
	}
}

export class DefaultNode<E extends TypeNode> extends TypeNode<Infer<E>> implements OptionalMarker {
	declare readonly _optional: true;
	constructor(
		readonly inner: E,
		value: Infer<E>,
	) {
		super();
		this.isOptional = true;
		this.defaultValue = { value };
	}
	override emit(e: Emitter, src: string, path: string): void {
		e.line(`if(${src}!==undefined){`);
		this.inner.emit(e, src, path);
		e.line('}');
	}
	override hasTransform(): boolean {
		return true;
	}
	override transform(e: Emitter, src: string): string {
		const dref = e.ref(this.defaultValue!.value);
		const inner = this.inner.hasTransform() ? this.inner.transform(e, src) : src;
		return `(${src}===undefined?${dref}:${inner})`;
	}
	override jsonSchema(): JsonSchema {
		return { ...this.inner.jsonSchema(), default: this.defaultValue!.value };
	}
}

/**
 * Custom refinement — the documented **slow path**. The predicate is a closure
 * that cannot be inlined, so it runs as a function call after the inner schema's
 * built-in (inlined) checks pass. Returning `true` accepts; returning `false` or
 * a `string` (used as the message) rejects. Prefer built-in constraints; reach
 * for `refine` only when no built-in expresses the rule.
 */
export class RefineNode<E extends TypeNode> extends TypeNode<Infer<E>> {
	constructor(
		readonly inner: E,
		readonly predicate: (value: Infer<E>) => boolean | string,
		readonly message = 'failed refinement',
	) {
		super();
		this.isOptional = inner.isOptional;
	}
	override emit(e: Emitter, src: string, path: string): void {
		this.inner.emit(e, src, path);
		const fn = e.ref(this.predicate);
		const r = e.freshVar();
		e.line(`var ${r}=${fn}(${src});`);
		e.line(`if(${r}!==true){${e.failExpr(`typeof ${r}==="string"?${r}:${JSON.stringify(this.message)}`, path)}}`);
	}
	override hasTransform(): boolean {
		return this.inner.hasTransform();
	}
	override transform(e: Emitter, src: string): string {
		return this.inner.transform(e, src);
	}
	override jsonSchema(): JsonSchema {
		return this.inner.jsonSchema();
	}
}

export class LazyNode<E extends TypeNode> extends TypeNode<Infer<E>> {
	private resolved?: E;
	constructor(readonly getter: () => E) {
		super();
	}
	private target(): E {
		return (this.resolved ??= this.getter());
	}
	override emit(e: Emitter, src: string, path: string): void {
		const helper = e.getHelper(this.target());
		const err = e.freshVar();
		e.line(`var ${err}=${helper}(R,${src});if(${err}!==0){${e.propagate(err, path)}}`);
	}
	override jsonSchema(): JsonSchema {
		return this.target().jsonSchema();
	}
}

// Inject the wrapper constructors used by the base-class chain methods.
reg.Optional = OptionalNode;
reg.Nullable = NullableNode;
reg.Default = DefaultNode;
reg.Refine = RefineNode;
