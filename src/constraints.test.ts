import { describe, expect, test } from 'bun:test';
import { t } from './index.js';

describe('string constraints (inline)', () => {
	test('length rules', () => {
		expect(t.string({ minLength: 3 }).check('ab')).toBe(false);
		expect(t.string({ maxLength: 3 }).check('abcd')).toBe(false);
		expect(t.string({ length: 3 }).check('abc')).toBe(true);
		expect(t.string({ nonEmpty: true }).check('')).toBe(false);
	});

	test('affix and substring rules', () => {
		expect(t.string({ startsWith: 'a' }).check('abc')).toBe(true);
		expect(t.string({ startsWith: 'a' }).check('xbc')).toBe(false);
		expect(t.string({ endsWith: 'c' }).check('abc')).toBe(true);
		expect(t.string({ includes: 'b' }).check('abc')).toBe(true);
		expect(t.string({ includes: 'z' }).check('abc')).toBe(false);
	});

	test('charset and pattern', () => {
		expect(t.string({ charset: 'a-z0-9_' }).check('hi_99')).toBe(true);
		expect(t.string({ charset: 'a-z0-9_' }).check('Hi!')).toBe(false);
		expect(t.string({ pattern: /^\d+$/ }).check('123')).toBe(true);
		expect(t.string({ pattern: /^\d+$/ }).check('12a')).toBe(false);
	});

	test('trim rejects surrounding whitespace', () => {
		expect(t.string({ trim: true }).check('hi')).toBe(true);
		expect(t.string({ trim: true }).check(' hi ')).toBe(false);
	});

	test('maxLines counts newlines inline', () => {
		const s = t.string({ maxLines: 2 });
		expect(s.check('a\nb')).toBe(true);
		expect(s.check('a\nb\nc')).toBe(false);
	});

	test('blockWords and allowedWords', () => {
		expect(t.string({ blockWords: ['spam', 'scam'] }).check('hello world')).toBe(true);
		expect(t.string({ blockWords: ['spam'] }).check('this is SPAM')).toBe(false);
		expect(t.string({ allowedWords: ['yes', 'no'] }).check('yes no yes')).toBe(true);
		expect(t.string({ allowedWords: ['yes', 'no'] }).check('yes maybe')).toBe(false);
	});
});

describe('string formats', () => {
	const cases: Array<[ReturnType<typeof t.string>, string, string]> = [
		[t.email(), 'a@b.co', 'a@'],
		[t.uuid(), '123e4567-e89b-12d3-a456-426614174000', 'not-a-uuid'],
		[t.url(), 'https://example.com/x', 'ftp:/bad'],
		[t.slug(), 'hello-world', 'Hello World'],
		[t.string({ format: 'ipv4' }), '192.168.0.1', '999.1.1.1'],
		[t.string({ format: 'datetime' }), '2020-01-02T03:04:05Z', '2020-01-02'],
		[t.string({ format: 'date' }), '2020-01-02', '2020/01/02'],
		[t.string({ format: 'hex' }), 'deadBEEF', 'xyz'],
		[t.string({ format: 'semver' }), '1.2.3', '1.2'],
		[t.string({ format: 'e164' }), '+14155552671', '5552671'],
		[t.string({ format: 'json' }), '{"a":1}', '{a:1}'],
		[t.string({ format: 'creditCard' }), '4242424242424242', '4242424242424241'],
	];
	test.each(cases)('format %#', (schema, good, bad) => {
		expect(schema.check(good)).toBe(true);
		expect(schema.check(bad)).toBe(false);
	});
});

describe('codegen correctness — issue paths', () => {
	test('reports the failing property path', () => {
		const schema = t.object({
			user: t.object({ name: t.string({ minLength: 3 }) }),
			tags: t.array(t.string()),
		});
		const r = schema.parse({ user: { name: 'ab' }, tags: ['ok', 9] }, { abortEarly: false });
		expect(r.issues).toBeDefined();
		const paths = r.issues!.map((i) => i.path.join('/'));
		expect(paths).toContain('user/name');
		expect(paths).toContain('tags/1');
	});

	test('abort-early returns exactly one issue', () => {
		const schema = t.object({ a: t.string(), b: t.string() });
		const r = schema.parse({ a: 1, b: 2 });
		expect(r.issues).toHaveLength(1);
	});
});

describe('array constraints', () => {
	test('item bounds and uniqueness', () => {
		expect(t.array(t.number(), { minItems: 1 }).check([])).toBe(false);
		expect(t.array(t.number(), { maxItems: 2 }).check([1, 2, 3])).toBe(false);
		expect(t.array(t.number(), { unique: true }).check([1, 2, 2])).toBe(false);
		expect(t.array(t.number(), { unique: true }).check([1, 2, 3])).toBe(true);
	});
});
