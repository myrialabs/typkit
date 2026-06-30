/**
 * Elysia consumes TypKit schemas natively (Standard Schema): valid requests reach
 * the handler, invalid ones return 422 with the issue path, and `t.coerce.*`
 * query schemas decode string params automatically.
 *
 *   bun run examples/elysia.ts
 */
import { Elysia } from 'elysia';
import { t } from '@myrialabs/typkit';

const app = new Elysia()
	.post('/users', ({ body }) => ({ created: body }), {
		body: t.object({
			name: t.string().minLength(2).maxLength(40),
			email: t.string().email(),
			age: t.int().min(0).max(120),
		}),
	})
	.get('/search', ({ query }) => query, {
		// Query params arrive as strings — coerce them.
		query: t.object({
			page: t.coerce.number().min(1),
			limit: t.coerce.number().min(1).max(100),
			active: t.coerce.boolean().optional(),
		}),
	})
	.listen(3000);

console.log(`Elysia listening on :${app.server?.port}`);
