/**
 * tRPC v11 accepts any Standard Schema as an input parser, so a TypKit schema is
 * usable directly — `input` is fully typed inside the resolver.
 *
 * This file illustrates the shape; it needs `@trpc/server` installed to run.
 */
import { initTRPC } from '@trpc/server';
import { t as k } from '@myrialabs/typkit';

const t = initTRPC.create();

export const appRouter = t.router({
	createUser: t.procedure
		.input(
			k.object({
				name: k.string().minLength(2),
				email: k.string().email(),
				age: k.int().min(0),
			}),
		)
		.mutation(({ input }) => {
			// `input` is { name: string; email: string; age: number }
			return { id: 1, ...input };
		}),

	listUsers: t.procedure
		.input(k.object({ page: k.int().min(1), q: k.string().optional() }))
		.query(({ input }) => ({ page: input.page, q: input.q ?? '' })),
});

export type AppRouter = typeof appRouter;
