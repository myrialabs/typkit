import { describe, expect, test } from 'bun:test';
import { Elysia } from 'elysia';
import { t } from '../index.js';

const json = (body: unknown) =>
	new Request('http://localhost/users', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});

describe('Elysia integration (native Standard Schema)', () => {
	const Body = t.object({ name: t.string({ minLength: 2 }), age: t.int({ min: 0 }) });
	const app = new Elysia().post('/users', ({ body }) => body, { body: Body });

	test('valid body reaches the handler (200)', async () => {
		const res = await app.handle(json({ name: 'ab', age: 3 }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ name: 'ab', age: 3 });
	});

	test('invalid body is rejected (422) with the issue path', async () => {
		const res = await app.handle(json({ name: 'a', age: -1 }));
		expect(res.status).toBe(422);
		const payload = (await res.json()) as { errors?: Array<{ path: unknown[] }> };
		const paths = (payload.errors ?? []).map((e) => e.path.join('/'));
		expect(paths).toContain('name');
	});

	test('query coercion decodes string params', async () => {
		const search = new Elysia().get('/search', ({ query }) => query, {
			query: t.object({ page: t.coerce.number({ min: 1 }) }),
		});
		const res = await search.handle(new Request('http://localhost/search?page=4'));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ page: 4 });
	});
});
