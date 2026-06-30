/**
 * Coercion for query/path params, where everything arrives as a string. `check`
 * stays a pure boolean; `parse`/`assert` return the coerced value.
 *
 *   bun run examples/coercion.ts
 */
import { t } from '@myrialabs/typkit';

const Query = t.object({
	page: t.coerce.number().min(1),
	limit: t.coerce.number().min(1).max(100).default(20),
	active: t.coerce.boolean().optional(),
	since: t.coerce.date().optional(),
});

// Simulate parsed query string values (all strings).
const raw = { page: '3', active: 'true', since: '2024-01-02T00:00:00Z' };

const result = Query.parse(raw);
if (result.value) {
	console.log(result.value);
	// { page: 3, limit: 20, active: true, since: Date(2024-01-02...) }
}

console.log('rejects non-numeric page:', Query.check({ page: 'abc' })); // false
