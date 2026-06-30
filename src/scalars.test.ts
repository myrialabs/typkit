import { describe, expect, test } from 'bun:test';
import { t } from './index.js';

describe('scalars', () => {
	test('string type gate', () => {
		const s = t.string();
		expect(s.check('hi')).toBe(true);
		expect(s.check(3)).toBe(false);
		expect(s.check(undefined)).toBe(false);
	});

	test('number and int', () => {
		expect(t.number().check(1.5)).toBe(true);
		expect(t.int().check(1.5)).toBe(false);
		expect(t.int().check(2)).toBe(true);
	});

	test('number is JSON-safe by default (NaN/Infinity allowed)', () => {
		expect(t.number().check(NaN)).toBe(true);
		expect(t.number().check(Infinity)).toBe(true);
	});

	test('finite is opt-in', () => {
		expect(t.number({ finite: true }).check(NaN)).toBe(false);
		expect(t.number({ finite: true }).check(Infinity)).toBe(false);
		expect(t.number({ finite: true }).check(3)).toBe(true);
	});

	test('boolean, bigint, date', () => {
		expect(t.boolean().check(true)).toBe(true);
		expect(t.boolean().check(0)).toBe(false);
		expect(t.bigint().check(1n)).toBe(true);
		expect(t.bigint().check(1)).toBe(false);
		expect(t.date().check(new Date())).toBe(true);
		expect(t.date().check(new Date('nope'))).toBe(false);
		expect(t.date().check('2020-01-01')).toBe(false);
	});

	test('literal and enum', () => {
		expect(t.literal('a').check('a')).toBe(true);
		expect(t.literal('a').check('b')).toBe(false);
		expect(t.literal(42).check(42)).toBe(true);
		expect(t.enum(['x', 'y']).check('y')).toBe(true);
		expect(t.enum(['x', 'y']).check('z')).toBe(false);
	});

	test('any, unknown, null, undefined', () => {
		expect(t.any().check(Symbol())).toBe(true);
		expect(t.unknown().check(null)).toBe(true);
		expect(t.null().check(null)).toBe(true);
		expect(t.null().check(0)).toBe(false);
		expect(t.undefined().check(undefined)).toBe(true);
		expect(t.undefined().check(null)).toBe(false);
	});

	test('assert returns the value and throws on failure', () => {
		expect(t.string().assert('ok')).toBe('ok');
		expect(() => t.string().assert(1)).toThrow();
	});

	test('number bounds: inclusive min/max, exclusive greaterThan/lessThan', () => {
		expect(t.number({ min: 1, max: 5 }).check(1)).toBe(true);
		expect(t.number({ min: 1, max: 5 }).check(5)).toBe(true);
		expect(t.number({ min: 1, max: 5 }).check(0)).toBe(false);
		expect(t.number({ greaterThan: 1 }).check(1)).toBe(false);
		expect(t.number({ greaterThan: 1 }).check(1.1)).toBe(true);
		expect(t.number({ lessThan: 5 }).check(5)).toBe(false);
	});

	test('number extras: multipleOf, positive, port, safeInt', () => {
		expect(t.number({ multipleOf: 3 }).check(9)).toBe(true);
		expect(t.number({ multipleOf: 3 }).check(10)).toBe(false);
		expect(t.number({ positive: true }).check(0)).toBe(false);
		expect(t.number({ port: true }).check(8080)).toBe(true);
		expect(t.number({ port: true }).check(70000)).toBe(false);
		expect(t.int({ safeInt: true }).check(Number.MAX_SAFE_INTEGER)).toBe(true);
		expect(t.int({ safeInt: true }).check(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
	});
});
