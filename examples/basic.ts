/**
 * Basic usage: build a schema, then check / assert / parse, and infer its type.
 *
 *   bun run examples/basic.ts
 */
import { t, type Infer } from '@myrialabs/typkit';

const BANNED = ['spam', 'scam'];

const Comment = t.object({
	author: t.string().minLength(3).maxLength(20).charset('a-z0-9_'),
	email: t.string().email(),
	body: t.string().nonEmpty().maxLines(500).blockWords(BANNED),
	rating: t.int().min(1).max(5),
	tags: t.string().array().optional(),
	visibility: t.enum(['public', 'private']),
});

type Comment = Infer<typeof Comment>;

const ok: Comment = {
	author: 'neo_42',
	email: 'neo@example.com',
	body: 'Loved it — thanks for sharing!',
	rating: 5,
	visibility: 'public',
};

console.log('check(valid):', Comment.check(ok)); // true

// `check` is the zero-allocation hot path — a boolean, nothing else.
console.log('check(invalid):', Comment.check({ ...ok, rating: 9 })); // false

// `parse` returns a discriminated result; pass abortEarly:false to collect all.
const result = Comment.parse({ ...ok, author: 'no', email: 'bad', rating: 9 }, { abortEarly: false });
if (result.issues) {
	for (const issue of result.issues) console.log(`  ${issue.path.join('/')}: ${issue.message}`);
}

// `assert` throws on failure and returns the typed value otherwise.
const value = Comment.assert(ok);
console.log('assert ok:', value.author);
