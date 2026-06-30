import { describe, expect, test } from 'bun:test';
import { t } from './index.js';

describe('toJsonSchema', () => {
	test('maps object shape, required, and constraints', () => {
		const schema = t.object({
			name: t.string({ minLength: 2, maxLength: 20 }),
			age: t.int({ min: 0, max: 120 }),
			email: t.email(),
			bio: t.optional(t.string()),
		});
		expect(schema.toJsonSchema()).toEqual({
			type: 'object',
			properties: {
				name: { type: 'string', minLength: 2, maxLength: 20 },
				age: { type: 'integer', minimum: 0, maximum: 120 },
				email: { type: 'string', format: 'email' },
				bio: { type: 'string' },
			},
			required: ['name', 'age', 'email'],
		});
	});

	test('exclusive bounds map to exclusiveMinimum/Maximum', () => {
		expect(t.number({ greaterThan: 0, lessThan: 1 }).toJsonSchema()).toEqual({
			type: 'number',
			exclusiveMinimum: 0,
			exclusiveMaximum: 1,
		});
	});

	test('arrays, enums, unions and defaults', () => {
		expect(t.array(t.string(), { minItems: 1 }).toJsonSchema()).toEqual({
			type: 'array',
			items: { type: 'string' },
			minItems: 1,
		});
		expect(t.enum(['a', 'b']).toJsonSchema()).toEqual({ enum: ['a', 'b'] });
		expect(t.union(t.string(), t.number()).toJsonSchema()).toEqual({
			anyOf: [{ type: 'string' }, { type: 'number' }],
		});
		expect(t.default(t.string(), 'x').toJsonSchema()).toEqual({ type: 'string', default: 'x' });
	});

	test('discriminatedUnion maps to oneOf', () => {
		const Msg = t.discriminatedUnion('type', [
			t.object({ type: t.literal('a'), x: t.number() }),
			t.object({ type: t.literal('b'), y: t.string() }),
		]);
		const js = Msg.toJsonSchema();
		expect(js.oneOf).toHaveLength(2);
	});
});
