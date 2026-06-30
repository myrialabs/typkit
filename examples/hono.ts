/**
 * Hono with the in-package validator middleware. The validated, coerced value is
 * available through `c.req.valid(target)`; failures return 400 with the issues.
 *
 *   bun run examples/hono.ts
 */
import { Hono } from 'hono';
import { t } from '@myrialabs/typkit';
import { validator } from '@myrialabs/typkit/middleware';

const app = new Hono()
	.post('/users', validator('json', t.object({ name: t.string().minLength(2), email: t.string().email() })), (c) => {
		const user = c.req.valid('json');
		return c.json({ created: user });
	})
	.get('/search', validator('query', t.object({ page: t.coerce.number().min(1) })), (c) => {
		const { page } = c.req.valid('query');
		return c.json({ page });
	});

export default app;
console.log('Hono app ready — `bun run examples/hono.ts` and POST /users');
