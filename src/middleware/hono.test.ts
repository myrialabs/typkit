import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { t } from '../index.js';
import { validator } from './index.js';

describe('Hono validator middleware', () => {
	const app = new Hono()
		.post('/users', validator('json', t.object({ name: t.string({ minLength: 2 }) })), (c) =>
			c.json(c.req.valid('json' as never)),
		)
		.get('/search', validator('query', t.object({ page: t.coerce.number({ min: 1 }) })), (c) =>
			c.json(c.req.valid('query' as never)),
		);

	test('valid json passes and is exposed via c.req.valid', async () => {
		const res = await app.request('/users', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'ab' }),
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ name: 'ab' });
	});

	test('invalid json returns 400 with issues', async () => {
		const res = await app.request('/users', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: 'a' }),
		});
		expect(res.status).toBe(400);
		const payload = (await res.json()) as { issues: Array<{ path: unknown[] }> };
		expect(payload.issues[0]!.path).toEqual(['name']);
	});

	test('query coercion is applied', async () => {
		const res = await app.request('/search?page=5');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ page: 5 });
	});
});
