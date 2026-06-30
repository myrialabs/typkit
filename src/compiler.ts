/**
 * IR → JS codegen and the lazily-compiled {@link TypeNode} base.
 *
 * A schema is a tree of nodes. Calling `check`/`assert`/`parse`/`~standard` on a
 * node compiles the tree **once** into a single monomorphic function via
 * `new Function`, then reuses it. Two invariants drive every design choice here:
 *
 *  - **Zero happy-path allocation.** The validator returns `0` on success — no
 *    wrapper object. An error record is allocated only on the failure branch, and
 *    a property path is built only while unwinding that branch.
 *  - **Inline constraints.** Rich rules (`maxLines`, `charset`, `blockWords`,
 *    formats, ranges, …) emit as literal expressions and loops, never closures.
 *    This is what competitors using `.refine()/.check()` cannot inline.
 */

import type { JsonSchema } from './json-schema.js';
import type { StandardSchemaV1 } from './standard-schema.js';
import { TypkitError, toIssue, type Issue, type ParseResult, type RawIssue } from './errors.js';
// Type-only imports (erased at runtime) — used to type the chain methods below.
// Their runtime classes are injected into `reg` to keep this module cycle-free.
import type { OptionalNode, NullableNode, DefaultNode, RefineNode } from './nodes/modifiers.js';
import type { ArrayNode } from './nodes/array.js';
import type { ArrayOpts } from './constraints/index.js';
import type { Infer } from './infer.js';

/**
 * Runtime constructor registry for the wrapper nodes that the base-class chain
 * methods (`optional`/`nullable`/`default`/`refine`/`array`) produce. The node
 * modules populate this on load, so `compiler.ts` never imports them at runtime
 * and there is no circular dependency.
 */
export interface NodeRegistry {
	Optional: new <E extends TypeNode>(inner: E) => OptionalNode<E>;
	Nullable: new <E extends TypeNode>(inner: E) => NullableNode<E>;
	Default: new <E extends TypeNode>(inner: E, value: Infer<E>) => DefaultNode<E>;
	Refine: new <E extends TypeNode>(inner: E, predicate: (value: E['_output']) => boolean | string, message?: string) => RefineNode<E>;
	Array: new <E extends TypeNode>(element: E, opts?: ArrayOpts) => ArrayNode<E>;
}

/** Populated by the node modules at load time (see `nodes/`). */
export const reg = {} as NodeRegistry;

/** Mutable state shared across every emitter in a single compilation. */
export interface CompileState {
	/** Runtime values (regexes, default values, …) referenced as `R[i]`. */
	refs: unknown[];
	/** Memoized helper-function names, keyed by the node they validate. */
	helpers: Map<TypeNode, string>;
	/** Emitted helper-function source definitions. */
	helperDefs: string[];
	/** Monotonic counter for fresh variable names. */
	uid: number;
}

/** A compiled validator: `0` on success, a {@link RawIssue} (abort) or array of them (collect). */
type ValidateFn = (R: unknown[], v: unknown) => 0 | RawIssue | RawIssue[];

/**
 * Code emitter for one function body. Holds the accumulating source lines plus
 * the shared {@link CompileState}, and knows whether it is emitting an
 * abort-early validator (returns on first failure) or a collecting one (pushes
 * every issue and continues).
 */
export class Emitter {
	lines: string[] = [];
	readonly mode: 'abort' | 'collect';
	readonly state: CompileState;
	/** Variable name of the issues array, in collect mode. */
	readonly issues = 'I';

	constructor(mode: 'abort' | 'collect', state: CompileState) {
		this.mode = mode;
		this.state = state;
	}

	/** A unique local variable name, e.g. `$3`. */
	freshVar(): string {
		return '$' + this.state.uid++;
	}

	/** Register a runtime value and return the expression that reads it back. */
	ref(value: unknown): string {
		this.state.refs.push(value);
		return `R[${this.state.refs.length - 1}]`;
	}

	/** Append a raw source line. */
	line(src: string): void {
		this.lines.push(src);
	}

	/** Statement that records a failure: `return` in abort mode, `push` in collect mode. */
	fail(message: string, pathExpr: string): string {
		const lit = `{m:${JSON.stringify(message)},p:${pathExpr}}`;
		return this.mode === 'abort' ? `return ${lit};` : `${this.issues}.push(${lit});`;
	}

	/** Like {@link fail}, but the message is a JS expression (for dynamic messages). */
	failExpr(messageExpr: string, pathExpr: string): string {
		const lit = `{m:${messageExpr},p:${pathExpr}}`;
		return this.mode === 'abort' ? `return ${lit};` : `${this.issues}.push(${lit});`;
	}

	/** Emit `if(<failCond>){ fail }` for an independent constraint check. */
	check(failCond: string, message: string, pathExpr: string): void {
		this.line(`if(${failCond}){${this.fail(message, pathExpr)}}`);
	}

	/**
	 * Emit a type gate. `failCond` is the condition under which the value has the
	 * wrong type. On the matching branch we fail; otherwise `body()` runs the
	 * type-dependent constraint checks. In collect mode the body is nested in an
	 * `else` so a type mismatch doesn't cascade into bogus constraint failures.
	 */
	gate(failCond: string, message: string, pathExpr: string, body: () => void): void {
		if (this.mode === 'abort') {
			this.line(`if(${failCond}){${this.fail(message, pathExpr)}}`);
			body();
		} else {
			this.line(`if(${failCond}){${this.fail(message, pathExpr)}}else{`);
			body();
			this.line('}');
		}
	}

	/** Propagate an existing error record, prefixing its path with `pathExpr`. */
	propagate(errVar: string, pathExpr: string): string {
		const adjust = `${errVar}.p=${pathExpr}.concat(${errVar}.p);`;
		return this.mode === 'abort' ? `${adjust}return ${errVar};` : `${adjust}${this.issues}.push(${errVar});`;
	}

	/**
	 * Compile `node` into a standalone abort-early helper function and return its
	 * name. Used for recursion (`lazy`) and union members. The helper is memoized,
	 * so a recursive reference encountered while compiling the body reuses the
	 * same function and the recursion terminates.
	 */
	getHelper(node: TypeNode): string {
		const existing = this.state.helpers.get(node);
		if (existing) return existing;
		const name = `h${this.state.helpers.size}`;
		this.state.helpers.set(node, name);
		const sub = new Emitter('abort', this.state);
		node.emit(sub, 'v', '[]');
		this.state.helperDefs.push(`function ${name}(R,v){${sub.lines.join('')}return 0;}`);
		return name;
	}
}

function buildValidator(root: TypeNode, mode: 'abort' | 'collect'): { fn: ValidateFn; refs: unknown[] } {
	const state: CompileState = { refs: [], helpers: new Map(), helperDefs: [], uid: 0 };
	const e = new Emitter(mode, state);
	root.emit(e, 'v', '[]');
	const defs = state.helperDefs.join('');
	const body =
		mode === 'abort'
			? `"use strict";${defs}${e.lines.join('')}return 0;`
			: `"use strict";${defs}var I=[];${e.lines.join('')}return I.length?I:0;`;
	const fn = new Function('R', 'v', body) as ValidateFn;
	return { fn, refs: state.refs };
}

function buildTransform(root: TypeNode): { fn: (R: unknown[], v: unknown) => unknown; refs: unknown[] } {
	const state: CompileState = { refs: [], helpers: new Map(), helperDefs: [], uid: 0 };
	const e = new Emitter('abort', state);
	const expr = root.transform(e, 'v');
	const body = `"use strict";${e.lines.join('')}return ${expr};`;
	const fn = new Function('R', 'v', body) as (R: unknown[], v: unknown) => unknown;
	return { fn, refs: state.refs };
}

/** Options for {@link TypeNode.parse}. */
export interface ParseOptions {
	/**
	 * Collect every issue instead of stopping at the first. Slightly slower and
	 * only runs the collecting validator; the default fast path is abort-early.
	 */
	abortEarly?: boolean;
}

/**
 * Base class for every schema node. Subclasses implement {@link emit} and
 * {@link jsonSchema}; this class supplies the public, lazily-compiled surface
 * (`check`, `assert`, `parse`, `~standard`, `toJsonSchema`) shared by all of them.
 *
 * `Out` is the inferred output type, surfaced through `t.infer<typeof schema>`.
 */
export abstract class TypeNode<Out = unknown> {
	/** Phantom carrier for type inference. Never read at runtime. */
	declare readonly _output: Out;

	/** Whether this node may be absent when used as an object property. */
	isOptional = false;

	/** When set, supplies a default for a missing/`undefined` value during parse. */
	defaultValue?: { value: unknown };

	/** Emit validation code for `src` (a JS expression) at `path` (a JS array expression). */
	abstract emit(e: Emitter, src: string, path: string): void;

	/** Produce the JSON Schema fragment for this node. */
	abstract jsonSchema(): JsonSchema;

	/** Whether parse must run a transform pass (coercion or default filling). */
	hasTransform(): boolean {
		return false;
	}

	/** Return a JS expression that evaluates to the transformed value of `src`. */
	transform(_e: Emitter, src: string): string {
		return src;
	}

	// --- lazily compiled artifacts -----------------------------------------

	private _abort?: { fn: ValidateFn; refs: unknown[] };
	private _collect?: { fn: ValidateFn; refs: unknown[] };
	private _transform?: { fn: (R: unknown[], v: unknown) => unknown; refs: unknown[] } | null;
	private _std?: StandardSchemaV1.Props<unknown, Out>;

	private abort(): { fn: ValidateFn; refs: unknown[] } {
		return (this._abort ??= buildValidator(this, 'abort'));
	}
	private collect(): { fn: ValidateFn; refs: unknown[] } {
		return (this._collect ??= buildValidator(this, 'collect'));
	}
	private xform(): { fn: (R: unknown[], v: unknown) => unknown; refs: unknown[] } | null {
		if (this._transform === undefined) this._transform = this.hasTransform() ? buildTransform(this) : null;
		return this._transform;
	}

	/** Validate `value`, returning `true` if it satisfies the schema. Zero-allocation hot path. */
	check(value: unknown): boolean {
		const { fn, refs } = this.abort();
		return fn(refs, value) === 0;
	}

	/** Validate `value`; throw {@link TypkitError} on failure, otherwise return it typed (and coerced). */
	assert(value: unknown): Out {
		const { fn, refs } = this.abort();
		const e = fn(refs, value);
		if (e !== 0) throw new TypkitError([toIssue(e as RawIssue)]);
		const x = this.xform();
		return (x ? x.fn(x.refs, value) : value) as Out;
	}

	/** Validate `value`, returning `{ value }` on success or `{ issues }` on failure. */
	parse(value: unknown, options?: ParseOptions): ParseResult<Out> {
		if (options?.abortEarly === false) {
			const { fn, refs } = this.collect();
			const e = fn(refs, value);
			if (e !== 0) return { issues: (e as RawIssue[]).map(toIssue) };
		} else {
			const { fn, refs } = this.abort();
			const e = fn(refs, value);
			if (e !== 0) return { issues: [toIssue(e as RawIssue)] };
		}
		const x = this.xform();
		return { value: (x ? x.fn(x.refs, value) : value) as Out };
	}

	/** Standard Schema v1 entry point — works in Elysia, Hono, tRPC, and more, with no adapter. */
	get ['~standard'](): StandardSchemaV1.Props<unknown, Out> {
		return (this._std ??= {
			version: 1,
			vendor: 'typkit',
			validate: (value: unknown): StandardSchemaV1.Result<Out> => {
				const { fn, refs } = this.abort();
				const e = fn(refs, value);
				if (e !== 0) return { issues: [toIssue(e as RawIssue) as Issue] };
				const x = this.xform();
				return { value: (x ? x.fn(x.refs, value) : value) as Out };
			},
		});
	}

	/** Export this schema as JSON Schema (OpenAPI / Swagger compatible). */
	toJsonSchema(): JsonSchema {
		return this.jsonSchema();
	}

	// --- chain modifiers (available on every node) -------------------------
	// Each returns a wrapper node at build time; the compiled validator is
	// unchanged, so chaining costs nothing on the validation hot path.

	/** Mark as optional — when used as an object property, the key may be omitted. */
	optional(): OptionalNode<this> {
		return new reg.Optional(this);
	}

	/** Allow `null` in addition to this type. */
	nullable(): NullableNode<this> {
		return new reg.Nullable(this);
	}

	/** Supply a default for a missing/`undefined` value (filled during `parse`/`assert`). */
	default(value: Out): DefaultNode<this> {
		// `Infer<this>` is `Out` but TypeScript defers the conditional over `this`.
		return new reg.Default(this, value as Infer<this>);
	}

	/**
	 * Add a custom predicate — the **slow path**. The closure cannot be inlined, so
	 * prefer built-in constraints. Return `true` to accept, or `false`/a message
	 * `string` to reject.
	 */
	refine(predicate: (value: Out) => boolean | string, message?: string): RefineNode<this> {
		return new reg.Refine(this, predicate, message);
	}

	/** Wrap this schema as the element type of an array: `t.string().array()`. */
	array(opts?: ArrayOpts): ArrayNode<this> {
		return new reg.Array(this, opts);
	}
}
