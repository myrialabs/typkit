import { describe, expect, test } from 'bun:test';
import { t } from './index.js';
import type { StandardSchemaV1 } from './index.js';

describe('Standard Schema', () => {
	const schema = t.object({ name: t.string({ minLength: 2 }), age: t.int({ min: 0 }) });

	test('exposes a conformant ~standard prop', () => {
		const std = schema['~standard'];
		expect(std.version).toBe(1);
		expect(std.vendor).toBe('typkit');
		expect(typeof std.validate).toBe('function');
	});

	test('validate returns { value } on success', () => {
		const r = schema['~standard'].validate({ name: 'ab', age: 3 }) as StandardSchemaV1.SuccessResult<unknown>;
		expect(r.issues).toBeUndefined();
		expect(r.value).toEqual({ name: 'ab', age: 3 });
	});

	test('validate returns { issues } with a path on failure', () => {
		const r = schema['~standard'].validate({ name: 'a', age: 3 }) as StandardSchemaV1.FailureResult;
		expect(r.issues).toHaveLength(1);
		expect(r.issues[0]!.path).toEqual(['name']);
	});

	test('coercion flows through the standard validate output', () => {
		const Query = t.object({ page: t.coerce.number({ min: 1 }) });
		const r = Query['~standard'].validate({ page: '7' }) as StandardSchemaV1.SuccessResult<{ page: number }>;
		expect(r.value).toEqual({ page: 7 });
	});
});
