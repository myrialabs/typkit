import { describe, expect, test } from 'bun:test';
import { t, type Infer } from './index.js';

describe('object algebra', () => {
	const Base = t.object({ id: t.int(), name: t.string(), email: t.email() });

	test('strip (default) ignores extra keys; strict rejects them', () => {
		expect(Base.check({ id: 1, name: 'a', email: 'a@b.co', extra: 1 })).toBe(true);
		expect(Base.strict().check({ id: 1, name: 'a', email: 'a@b.co', extra: 1 })).toBe(false);
	});

	test('partial makes everything optional', () => {
		expect(Base.partial().check({})).toBe(true);
		expect(Base.partial().check({ id: 'x' })).toBe(false);
	});

	test('pick and omit', () => {
		expect(Base.pick(['id']).check({ id: 1 })).toBe(true);
		expect(Base.omit(['email']).check({ id: 1, name: 'a' })).toBe(true);
	});

	test('extend merges shapes', () => {
		const Ext = Base.extend({ age: t.int({ min: 0 }) });
		expect(Ext.check({ id: 1, name: 'a', email: 'a@b.co', age: 3 })).toBe(true);
		expect(Ext.check({ id: 1, name: 'a', email: 'a@b.co' })).toBe(false);
	});
});

describe('optional / nullable / default', () => {
	test('optional property', () => {
		const s = t.object({ a: t.string(), b: t.optional(t.number()) });
		expect(s.check({ a: 'x' })).toBe(true);
		expect(s.check({ a: 'x', b: 2 })).toBe(true);
		expect(s.check({ a: 'x', b: 'no' })).toBe(false);
	});

	test('nullable allows null', () => {
		const s = t.nullable(t.string());
		expect(s.check(null)).toBe(true);
		expect(s.check('x')).toBe(true);
		expect(s.check(3)).toBe(false);
	});

	test('default fills missing values on parse', () => {
		const s = t.object({ role: t.default(t.string(), 'user'), name: t.string() });
		expect(s.parse({ name: 'a' })).toEqual({ value: { name: 'a', role: 'user' } });
		expect(s.parse({ name: 'a', role: 'admin' })).toEqual({ value: { name: 'a', role: 'admin' } });
	});
});

describe('union / discriminatedUnion / intersection', () => {
	test('union matches any member', () => {
		const s = t.union(t.string(), t.number());
		expect(s.check('a')).toBe(true);
		expect(s.check(1)).toBe(true);
		expect(s.check(true)).toBe(false);
	});

	test('discriminatedUnion dispatches on the tag', () => {
		const Msg = t.discriminatedUnion('type', [
			t.object({ type: t.literal('text'), content: t.string() }),
			t.object({ type: t.literal('image'), url: t.url() }),
		]);
		expect(Msg.check({ type: 'text', content: 'hi' })).toBe(true);
		expect(Msg.check({ type: 'image', url: 'https://a.co/x' })).toBe(true);
		expect(Msg.check({ type: 'image', url: 'nope' })).toBe(false);
		expect(Msg.check({ type: 'audio' })).toBe(false);
	});

	test('intersection requires both', () => {
		const s = t.intersection(t.object({ a: t.string() }), t.object({ b: t.number() }));
		expect(s.check({ a: 'x', b: 1 })).toBe(true);
		expect(s.check({ a: 'x' })).toBe(false);
	});
});

describe('tuple and record', () => {
	test('tuple is fixed length and positional', () => {
		const s = t.tuple(t.string(), t.number());
		expect(s.check(['a', 1])).toBe(true);
		expect(s.check(['a', 1, 2])).toBe(false);
		expect(s.check([1, 'a'])).toBe(false);
	});

	test('record validates every value', () => {
		const s = t.record(t.number());
		expect(s.check({ a: 1, b: 2 })).toBe(true);
		expect(s.check({ a: 1, b: 'x' })).toBe(false);
	});
});

describe('recursive (lazy)', () => {
	type Category = { name: string; children: Category[] };
	const Category: ReturnType<typeof t.lazy> = t.lazy(() =>
		t.object({ name: t.string(), children: t.array(Category) }),
	);

	test('validates nested recursive structures', () => {
		const value: Category = { name: 'a', children: [{ name: 'b', children: [] }] };
		expect(Category.check(value)).toBe(true);
		expect(Category.check({ name: 'a', children: [{ name: 1, children: [] }] })).toBe(false);
	});
});

describe('type inference', () => {
	test('infer produces the expected shape (compile-time)', () => {
		const User = t.object({
			id: t.int(),
			name: t.string(),
			roles: t.array(t.enum(['admin', 'user'])),
			bio: t.optional(t.string()),
		});
		type User = Infer<typeof User>;
		const u: User = { id: 1, name: 'a', roles: ['admin'] };
		expect(User.check(u)).toBe(true);
	});
});

describe('refine (escape hatch)', () => {
	test('boolean predicate runs after built-in checks', () => {
		const Even = t.refine(t.int(), (n) => n % 2 === 0, 'must be even');
		expect(Even.check(4)).toBe(true);
		expect(Even.check(3)).toBe(false);
		expect(Even.check('x')).toBe(false); // base int check still applies
		const r = Even.parse(3);
		expect(r.issues?.[0]?.message).toBe('must be even');
	});

	test('string-returning predicate supplies a dynamic message', () => {
		const s = t.refine(t.string(), (v) => (v.startsWith('a') ? true : `must start with a, got ${v[0]}`));
		expect(s.parse('xyz').issues?.[0]?.message).toBe('must start with a, got x');
	});
});
