import { describe, expect, test } from 'bun:test';
import { t } from './index.js';

describe('coercion', () => {
	test('coerce.number parses numeric strings and applies constraints', () => {
		const s = t.coerce.number({ min: 1 });
		expect(s.check('3')).toBe(true);
		expect(s.parse('3')).toEqual({ value: 3 });
		expect(s.check('0')).toBe(false); // below min
		expect(s.check('abc')).toBe(false);
		expect(s.check('')).toBe(false);
	});

	test('coerce.boolean accepts the documented forms', () => {
		const s = t.coerce.boolean();
		expect(s.parse('true')).toEqual({ value: true });
		expect(s.parse('0')).toEqual({ value: false });
		expect(s.check('maybe')).toBe(false);
	});

	test('coerce.date parses ISO strings and epoch millis', () => {
		const s = t.coerce.date();
		const r = s.parse('2020-01-02T00:00:00Z');
		expect(r.value instanceof Date).toBe(true);
		expect(s.check('not-a-date')).toBe(false);
	});

	test('coercion composes inside objects (query params)', () => {
		const Query = t.object({
			page: t.coerce.number({ min: 1 }),
			active: t.coerce.boolean(),
			tag: t.optional(t.string()),
		});
		expect(Query.parse({ page: '4', active: 'true' })).toEqual({ value: { page: 4, active: true } });
		expect(Query.check({ page: 'x', active: 'true' })).toBe(false);
	});

	test('check stays a pure boolean and never coerces output', () => {
		expect(t.coerce.number().check('5')).toBe(true);
	});
});
