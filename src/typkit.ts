/**
 * The `t` builder — the entire authoring surface. Every factory returns a
 * {@link TypeNode}, which is both composable (usable inside `object`/`array`/…)
 * and directly runnable (`.check`/`.assert`/`.parse`/`['~standard']`/
 * `.toJsonSchema`), compiling itself on first use.
 *
 * Constraints can be applied by chaining methods (`t.int().min(1).max(5)`, the
 * recommended style) or by passing a config object (`t.int({ min: 1, max: 5 })`);
 * both compile to the identical validator. Naming is self-documenting: `min`/`max`
 * are inclusive bounds, `greaterThan`/`lessThan` are exclusive, no `gte`/`lt`.
 */

import { TypeNode } from './compiler.js';
import type { Infer, InferObject } from './infer.js';
import type { StringOpts, NumberOpts, ArrayOpts } from './constraints/index.js';
import {
	StringNode,
	NumberNode,
	BooleanNode,
	BigIntNode,
	DateNode,
	LiteralNode,
	EnumNode,
	AnyNode,
	UnknownNode,
	NullNode,
	UndefinedNode,
	ObjectNode,
	ArrayNode,
	TupleNode,
	RecordNode,
	UnionNode,
	DiscriminatedUnionNode,
	IntersectionNode,
	OptionalNode,
	NullableNode,
	DefaultNode,
	LazyNode,
	RefineNode,
	type Literal,
} from './nodes/index.js';
import { CoerceNumberNode, CoerceBooleanNode, CoerceDateNode } from './coerce.js';

type Shape = Record<string, TypeNode>;

/** Coercion builders for query/path parameters (string → typed). */
const coerce = {
	/** Coerce with `Number()`, then apply number constraints. */
	number: (opts?: NumberOpts): CoerceNumberNode => new CoerceNumberNode(opts),
	/** Coerce `'true'`/`'false'`/`'1'`/`'0'`/`1`/`0` to a boolean. */
	boolean: (): CoerceBooleanNode => new CoerceBooleanNode(),
	/** Coerce with `new Date()` (accepts ISO strings, epoch millis, or `Date`). */
	date: (): CoerceDateNode => new CoerceDateNode(),
};

/**
 * The schema builder. Import as `import { t } from '@myrialabs/typkit'` and compose nodes.
 *
 * @example
 * ```ts
 * const User = t.object({
 *   name: t.string().minLength(2),
 *   age: t.int().min(0),
 *   tags: t.string().array().optional(),
 * });
 * User.check(value);          // boolean (zero-alloc hot path)
 * type User = t.infer<typeof User>;
 * ```
 */
export const t = {
	// --- scalars -----------------------------------------------------------
	/** A string, with optional inline constraints and formats. */
	string: (opts?: StringOpts): StringNode => new StringNode(opts),
	/** A number. `finite` is off by default (JSON-safe); opt in for non-JSON sources. */
	number: (opts?: NumberOpts): NumberNode => new NumberNode(opts),
	/** An integer (shortcut for `number({ integer: true })`). */
	int: (opts?: Omit<NumberOpts, 'integer'>): NumberNode => new NumberNode({ ...opts, integer: true }),
	/** A boolean. */
	boolean: (): BooleanNode => new BooleanNode(),
	/** A `bigint`. */
	bigint: (): BigIntNode => new BigIntNode(),
	/** A valid `Date` instance. */
	date: (): DateNode => new DateNode(),
	/** An exact literal value. */
	literal: <const V extends Literal>(value: V): LiteralNode<V> => new LiteralNode(value),
	/** A value drawn from a fixed set. */
	enum: <const V extends string | number>(values: readonly V[]): EnumNode<V> => new EnumNode(values),
	/** Any value (no checks). */
	any: (): AnyNode => new AnyNode(),
	/** Any value, typed as `unknown`. */
	unknown: (): UnknownNode => new UnknownNode(),
	/** The `null` literal. */
	null: (): NullNode => new NullNode(),
	/** The `undefined` literal. */
	undefined: (): UndefinedNode => new UndefinedNode(),

	// --- string format shortcuts ------------------------------------------
	/** An email address. */
	email: (opts?: Omit<StringOpts, 'format'>): StringNode => new StringNode({ ...opts, format: 'email' }),
	/** A UUID. */
	uuid: (opts?: Omit<StringOpts, 'format'>): StringNode => new StringNode({ ...opts, format: 'uuid' }),
	/** An HTTP(S) URL. */
	url: (opts?: Omit<StringOpts, 'format'>): StringNode => new StringNode({ ...opts, format: 'url' }),
	/** A lowercase slug (`a-z0-9` with single hyphens). */
	slug: (opts?: Omit<StringOpts, 'format'>): StringNode => new StringNode({ ...opts, format: 'slug' }),

	// --- composites --------------------------------------------------------
	/** An object with a fixed shape. */
	object: <S extends Shape>(shape: S): ObjectNode<S> => new ObjectNode(shape),
	/** A homogeneous array. */
	array: <E extends TypeNode>(element: E, opts?: ArrayOpts): ArrayNode<E> => new ArrayNode(element, opts),
	/** A fixed-length tuple. */
	tuple: <const T extends readonly TypeNode[]>(...items: T): TupleNode<T> => new TupleNode(items),
	/** An object with arbitrary string keys and a uniform value type. */
	record: <V extends TypeNode>(value: V, keyPattern?: RegExp): RecordNode<V> => new RecordNode(value, keyPattern),
	/** A union — value matches any member. */
	union: <const T extends readonly TypeNode[]>(...options: T): UnionNode<T> => new UnionNode(options),
	/** A discriminated union — O(1) dispatch on the `key` tag. */
	discriminatedUnion: <K extends string, const T extends readonly ObjectNode<any>[]>(key: K, options: T): DiscriminatedUnionNode<K, T> =>
		new DiscriminatedUnionNode(key, options),
	/** An intersection — value matches both members. */
	intersection: <A extends TypeNode, B extends TypeNode>(left: A, right: B): IntersectionNode<A, B> => new IntersectionNode(left, right),

	// --- modifiers ---------------------------------------------------------
	/** Mark a value (or object property) as optional. */
	optional: <E extends TypeNode>(inner: E): OptionalNode<E> => new OptionalNode(inner),
	/** Allow `null` in addition to the inner type. */
	nullable: <E extends TypeNode>(inner: E): NullableNode<E> => new NullableNode(inner),
	/** Supply a default for a missing/`undefined` value (filled during `parse`/`assert`). */
	default: <E extends TypeNode>(inner: E, value: Infer<E>): DefaultNode<E> => new DefaultNode(inner, value),
	/** Defer construction for self-referential (recursive) schemas. */
	lazy: <E extends TypeNode>(getter: () => E): LazyNode<E> => new LazyNode(getter),
	/**
	 * Add a custom predicate — the **slow path**. The closure cannot be inlined and
	 * runs after the inner schema's built-in checks. Return `true` to accept, or
	 * `false`/a message `string` to reject. Prefer built-in constraints.
	 */
	refine: <E extends TypeNode>(inner: E, predicate: (value: Infer<E>) => boolean | string, message?: string): RefineNode<E> =>
		new RefineNode(inner, predicate, message),

	// --- coercion ----------------------------------------------------------
	/** String → typed coercion for query/path params. */
	coerce,
};

// Type-level companion: `t.infer<typeof Schema>` reads the inferred output type.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace t {
	/** Infer the output type of a schema. */
	export type infer<S extends TypeNode> = S extends ObjectNode<infer Sh> ? InferObject<Sh> : Infer<S>;
}
