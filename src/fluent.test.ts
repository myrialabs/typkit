import { describe, expect, test } from 'bun:test';
import { t, type Infer } from './index.js';

describe('fluent (chain) API', () => {
	test('string constraints chain', () => {
		const s = t.string().minLength(3).maxLength(20).charset('a-z0-9_');
		expect(s.check('neo_42')).toBe(true);
		expect(s.check('no')).toBe(false);
		expect(s.check('Has Spaces')).toBe(false);
	});

	test('format shortcuts as methods', () => {
		expect(t.string().email().check('a@b.co')).toBe(true);
		expect(t.string().email().check('nope')).toBe(false);
		expect(t.string().format('ipv4').check('1.2.3.4')).toBe(true);
	});

	test('number constraints chain', () => {
		const n = t.int().min(13).max(120);
		expect(n.check(30)).toBe(true);
		expect(n.check(12)).toBe(false);
		expect(n.check(13)).toBe(true);
		expect(t.number().greaterThan(0).lessThan(1).check(0.5)).toBe(true);
		expect(t.number().greaterThan(0).check(0)).toBe(false);
	});

	test('chain produces byte-identical codegen to the config-object form', () => {
		const fluent = t.int().min(1).max(5);
		const braces = t.int({ min: 1, max: 5 });
		const source = (n: unknown): string => {
			(n as { check(v: unknown): boolean }).check(0);
			return String((n as { _abort: { fn: unknown } })._abort.fn);
		};
		expect(source(fluent)).toBe(source(braces));
	});

	test('base modifiers chain on every node', () => {
		expect(t.string().optional().check(undefined)).toBe(true);
		expect(t.string().nullable().check(null)).toBe(true);
		expect(t.object({ role: t.string().default('user') }).parse({})).toEqual({ value: { role: 'user' } });
		expect(t.int().refine((n) => n % 2 === 0, 'even').check(3)).toBe(false);
	});

	test('.array() wraps the element type', () => {
		const s = t.string().array().minItems(1).unique();
		expect(s.check(['a', 'b'])).toBe(true);
		expect(s.check([])).toBe(false);
		expect(s.check(['a', 'a'])).toBe(false);
	});

	test('coerce chain', () => {
		expect(t.coerce.number().min(1).parse('5')).toEqual({ value: 5 });
		expect(t.coerce.number().min(1).check('0')).toBe(false);
	});

	test('inference matches through the chain', () => {
		const User = t.object({
			name: t.string().minLength(2),
			age: t.int().min(0),
			tags: t.string().array().optional(),
		});
		type User = Infer<typeof User>;
		const u: User = { name: 'ab', age: 1 };
		expect(User.check(u)).toBe(true);
	});
});
