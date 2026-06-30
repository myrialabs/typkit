/**
 * TypKit benchmark harness.
 *
 * Runs validation benchmarks and writes a report to `bench-results.md`.
 * Single source of truth — all performance claims must cite this file.
 *
 *   bun run bench                 # builds dist/, then benchmarks on Bun
 *   node --experimental-strip-types bench.ts   # after `bun run build`, on Node
 *
 * Each category rotates over a pool of cloned inputs to defeat dead-code
 * elimination and per-input caching. Honest reading: bare primitives sit on a
 * ~1 ns floor where every library ties; the wins are in structured schemas and,
 * above all, the rich inline constraints competitors cannot inline.
 */

import { run, bench, group, summary, do_not_optimize } from 'mitata';
import { execSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, totalmem } from 'node:os';
import { z } from 'zod';
import * as v from 'valibot';
import { type } from 'arktype';
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { Schema } from 'effect';
import { t } from './dist/index.js';

const rt = typeof (globalThis as any).Bun !== 'undefined' ? `Bun ${(globalThis as any).Bun.version}` : `Node ${process.version}`;
console.log('# TypKit benchmark — runtime:', rt, '\n');

// Collect mitata output for auto-generating bench-results.md
const _reportLines: string[] = [];
function _capturePrint(...args: any[]) {
	const line = args.map(a => String(a)).join(' ');
	_reportLines.push(line);
	console.log(...args);
}

type BenchRow = {
	name: string;
	avg: string;
};

type BenchSection = {
	title: string;
	rows: BenchRow[];
	fastest: string;
	comparisons: string[];
};

const BENCH_NOTES: Record<string, string> = {
	'1) primitive string': '~1 ns floor; treat tiny gaps as ties.',
	'2) shallow object (8 fields)': 'Flat object validation across eight scalar fields.',
	'3) signup (nested + email + ranges)': 'Nested object, regex email, integer ranges, and zip constraints.',
	'4) comment-rich (maxLines + blockWords) — TypeBox cannot express': 'Rich inline string rules; TypeBox is omitted because the schema is not expressible.',
	'5) api-list (array of 100 objects)': 'Array traversal plus object and numeric/string constraints.',
	'6) discriminated union (O(1) tag dispatch)': 'Tagged union dispatch through a discriminant.',
};

const COMPARED_PACKAGES = ['zod', 'valibot', 'arktype', '@sinclair/typebox', 'effect'];

function stripAnsi(s: string): string {
	return s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

function titleCasePackage(name: string): string {
	if (name === '@sinclair/typebox') return 'TypeBox';
	if (name === 'arktype') return 'ArkType';
	if (name === 'effect') return 'effect/Schema';
	return name[0]!.toUpperCase() + name.slice(1);
}

function titleCaseRunner(name: string): string {
	if (name.startsWith('typebox')) return name.replace('typebox', 'TypeBox');
	if (name.startsWith('arktype')) return name.replace('arktype', 'ArkType');
	if (name.startsWith('typkit')) return name.replace('typkit', 'TypKit');
	if (name.startsWith('zod')) return name.replace('zod', 'Zod');
	if (name.startsWith('valibot')) return name.replace('valibot', 'Valibot');
	if (name.startsWith('effect')) return name.replace('effect', 'effect/Schema');
	return name;
}

function commitSha(): string {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'unknown';
	}
}

function displayComparison(comparison: string): string {
	return comparison.replace(/^([0-9.]+x faster than )(.+)$/, (_, prefix: string, runner: string) => {
		return prefix + titleCaseRunner(runner);
	});
}

function parseBenchReport(raw: string): BenchSection[] {
	const sections: BenchSection[] = [];
	let current: BenchSection | undefined;
	let inSummary = false;
	let waitingForFastest = false;

	for (const line of raw.split('\n')) {
		const title = line.match(/^• (.+)$/);
		if (title) {
			current = { title: title[1]!, rows: [], fastest: '', comparisons: [] };
			sections.push(current);
			inSummary = false;
			waitingForFastest = false;
			continue;
		}

		if (!current) continue;

		if (line.trim() === 'summary') {
			inSummary = true;
			waitingForFastest = true;
			continue;
		}

		if (inSummary) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			if (waitingForFastest) {
				current.fastest = titleCaseRunner(trimmed);
				waitingForFastest = false;
				continue;
			}
			if (/^[0-9.]+x faster than /.test(trimmed)) {
				current.comparisons.push(displayComparison(trimmed));
			}
			continue;
		}

		const row = line.match(/^([a-z][^\d]*?)\s+([0-9.]+\s+(?:ps|ns|µs|ms|s)\/iter)\b/i);
		if (row) {
			current.rows.push({ name: titleCaseRunner(row[1]!.trim()), avg: row[2]! });
		}
	}

	return sections;
}

function typkitAverage(section: BenchSection): string {
	return section.rows.find(row => row.name === 'TypKit')?.avg ?? 'n/a';
}

function topResult(section: BenchSection): string {
	if (!section.comparisons.length) return section.fastest ? `${section.fastest} fastest` : 'n/a';

	const first = section.comparisons[0]!;
	const factor = Number(first.match(/^([0-9.]+)x/)?.[1]);
	if (Number.isFinite(factor) && factor < 1.1) {
		return `${first} (tie range)`;
	}
	return first;
}

async function packageVersions(): Promise<string> {
	try {
		const pkg = JSON.parse(await readFile('package.json', 'utf8')) as {
			devDependencies?: Record<string, string>;
			dependencies?: Record<string, string>;
		};
		const deps = { ...pkg.dependencies, ...pkg.devDependencies };
		return COMPARED_PACKAGES
			.map(name => `${titleCasePackage(name)} ${deps[name] ?? 'unknown'}`)
			.join(' · ');
	} catch {
		return COMPARED_PACKAGES.map(titleCasePackage).join(' · ');
	}
}

async function createBenchResultsMarkdown(rawBody: string): Promise<string> {
	const sections = parseBenchReport(rawBody);
	const cpu = cpus()[0]?.model ?? 'unknown CPU';
	const date = new Date().toISOString().slice(0, 10);
	const versions = await packageVersions();
	const summaryRows = sections.map((section, index) => {
		const note = BENCH_NOTES[section.title] ?? '';
		return `| ${index + 1} | ${section.title.replace(/^\d+\) /, '')} | ${typkitAverage(section)} | ${topResult(section)} | ${note} |`;
	});

	return [
		'# TypKit Benchmark Results',
		'',
		'Generated by `bun run bench`. Numbers are machine-specific; re-run on your target runtime before quoting them.',
		'',
		'## Environment',
		'',
		`- Runtime: ${rt}`,
		`- OS: ${platform()} ${arch()}`,
		`- CPU: ${cpu} x ${cpus().length}`,
		`- RAM: ${(totalmem() / 1e9).toFixed(1)} GB`,
		`- Commit: ${commitSha()}`,
		`- Date: ${date}`,
		`- Compared against: ${versions}`,
		'',
		'## Method',
		'',
		'Benchmarks run through `mitata`. Each case validates cloned inputs from a rotating pool to avoid dead-code elimination and per-input caching. The primitive string case sits near the timing floor, so small factors there should be read as ties; the structured cases are the useful signal.',
		'',
		'## Summary',
		'',
		'| # | Benchmark | TypKit avg | Result | Notes |',
		'|---:|---|---:|---|---|',
		...summaryRows,
		'',
		'## Full comparison',
		'',
		...sections.flatMap((section, index) => [
			`### ${index + 1}. ${section.title.replace(/^\d+\) /, '')}`,
			'',
			`**Headline:** ${topResult(section)}.`,
			'',
			BENCH_NOTES[section.title] ?? '',
			'',
			'| Library | Avg / iteration |',
			'|---|---:|',
			...section.rows.map(row => `| ${row.name} | ${row.avg} |`),
			'',
		]),
		'## Relative speedups',
		'',
		...sections.flatMap(section => [
			`### ${section.title}`,
			'',
			section.comparisons.length ? section.comparisons.map(item => `- ${item}`).join('\n') : '- n/a',
			'',
		]),
		'## Legend',
		'',
		'- **Avg / iteration**: lower is faster.',
		'- **Result**: the first `mitata` summary comparison for the fastest implementation in that case.',
		'- **TypKit**: compiled validator from `dist/`, generated once on first use.',
		'- **TypeBox**: compiled TypeBox validator.',
		'- **Refine/check/narrow**: competitor closure-based equivalents for TypKit inline constraints.',
		'- **TypeBox omitted** in the comment-rich case because `maxLines` and `blockWords` are not expressible as equivalent TypeBox constraints.',
		'',
	].join('\n');
}

function reportToConsole(report: string): void {
	process.stdout.write(report);
	if (!report.endsWith('\n')) process.stdout.write('\n');
}
async function writeReport(rawBody: string): Promise<void> {
	const report = await createBenchResultsMarkdown(rawBody);
	await writeFile('bench-results.md', report, 'utf8');
	reportToConsole(report);
	process.stderr.write('\nWrote bench-results.md\n');
}
/*
 * Kept below the report renderer so the benchmark declarations remain the only
 * executable work before `run()`.
 */

const BANNED = ['spam', 'scam', 'viagra', 'casino'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function pool<T>(d: T, n = 16): T[] {
	return Array.from({ length: n }, () => structuredClone(d));
}
let i = 0;

// ---------------------------------------------------------------------------
// 1) Primitive — the hard ~1 ns floor; target is a tie, not a win.
// ---------------------------------------------------------------------------
const tkStr = t.string();
const zStr = z.string();
const vStr = v.string();
const aStr = type('string');
const tbStr = TypeCompiler.Compile(Type.String());
const eStr = Schema.is(Schema.String);
const strPool = pool('hello world');
group('1) primitive string', () => {
	summary(() => {
		bench('typkit', () => do_not_optimize(tkStr.check(strPool[i++ & 15])));
		bench('typebox', () => do_not_optimize(tbStr.Check(strPool[i++ & 15])));
		bench('arktype', () => do_not_optimize(aStr(strPool[i++ & 15])));
		bench('zod', () => do_not_optimize(zStr.safeParse(strPool[i++ & 15])));
		bench('valibot', () => do_not_optimize(v.safeParse(vStr, strPool[i++ & 15])));
		bench('effect', () => do_not_optimize(eStr(strPool[i++ & 15])));
	});
});

// ---------------------------------------------------------------------------
// 2) Shallow object (8 fields).
// ---------------------------------------------------------------------------
const obj8 = { a: 1, b: 'x', c: true, d: 2, e: 'y', f: false, g: 3, h: 'z' };
const tkObj = t.object({ a: t.number(), b: t.string(), c: t.boolean(), d: t.number(), e: t.string(), f: t.boolean(), g: t.number(), h: t.string() });
const zObj = z.object({ a: z.number(), b: z.string(), c: z.boolean(), d: z.number(), e: z.string(), f: z.boolean(), g: z.number(), h: z.string() });
const vObj = v.object({ a: v.number(), b: v.string(), c: v.boolean(), d: v.number(), e: v.string(), f: v.boolean(), g: v.number(), h: v.string() });
const aObj = type({ a: 'number', b: 'string', c: 'boolean', d: 'number', e: 'string', f: 'boolean', g: 'number', h: 'string' });
const tbObj = TypeCompiler.Compile(Type.Object({ a: Type.Number(), b: Type.String(), c: Type.Boolean(), d: Type.Number(), e: Type.String(), f: Type.Boolean(), g: Type.Number(), h: Type.String() }));
const op = pool(obj8);
group('2) shallow object (8 fields)', () => {
	summary(() => {
		bench('typkit', () => do_not_optimize(tkObj.check(op[i++ & 15])));
		bench('typebox', () => do_not_optimize(tbObj.Check(op[i++ & 15])));
		bench('arktype', () => do_not_optimize(aObj(op[i++ & 15])));
		bench('zod', () => do_not_optimize(zObj.safeParse(op[i++ & 15])));
		bench('valibot', () => do_not_optimize(v.safeParse(vObj, op[i++ & 15])));
	});
});

// ---------------------------------------------------------------------------
// 3) Signup — nested object, email pattern, integer ranges, zip charset.
// ---------------------------------------------------------------------------
const signup = { email: 'ada@example.com', password: 's3cretpw123', age: 30, address: { street: '1 Bridge St', city: 'London', zip: '12345' } };
const tkSignup = t.object({
	email: t.string().pattern(EMAIL),
	password: t.string().minLength(8).maxLength(72),
	age: t.int().min(13).max(120),
	address: t.object({ street: t.string().minLength(1), city: t.string().minLength(1), zip: t.string().length(5).charset('0-9') }),
});
const zSignup = z.object({ email: z.string().regex(EMAIL), password: z.string().min(8).max(72), age: z.number().int().min(13).max(120), address: z.object({ street: z.string().min(1), city: z.string().min(1), zip: z.string().length(5).regex(/^[0-9]+$/) }) });
const vSignup = v.object({ email: v.pipe(v.string(), v.regex(EMAIL)), password: v.pipe(v.string(), v.minLength(8), v.maxLength(72)), age: v.pipe(v.number(), v.integer(), v.minValue(13), v.maxValue(120)), address: v.object({ street: v.pipe(v.string(), v.minLength(1)), city: v.pipe(v.string(), v.minLength(1)), zip: v.pipe(v.string(), v.length(5), v.regex(/^[0-9]+$/)) }) });
const aSignup = type({ email: '/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/', password: 'string >= 8', age: '13 <= number.integer <= 120', address: { street: 'string >= 1', city: 'string >= 1', zip: '/^[0-9]+$/ & string == 5' } });
const tbSignup = TypeCompiler.Compile(Type.Object({ email: Type.String({ pattern: EMAIL.source }), password: Type.String({ minLength: 8, maxLength: 72 }), age: Type.Integer({ minimum: 13, maximum: 120 }), address: Type.Object({ street: Type.String({ minLength: 1 }), city: Type.String({ minLength: 1 }), zip: Type.String({ minLength: 5, maxLength: 5, pattern: '^[0-9]+$' }) }) }));
const sp = pool(signup);
group('3) signup (nested + email + ranges)', () => {
	summary(() => {
		bench('typkit', () => do_not_optimize(tkSignup.check(sp[i++ & 15])));
		bench('typebox', () => do_not_optimize(tbSignup.Check(sp[i++ & 15])));
		bench('arktype', () => do_not_optimize(aSignup(sp[i++ & 15])));
		bench('zod', () => do_not_optimize(zSignup.safeParse(sp[i++ & 15])));
		bench('valibot', () => do_not_optimize(v.safeParse(vSignup, sp[i++ & 15])));
	});
});

// ---------------------------------------------------------------------------
// 4) Comment-rich — maxLines + blockWords + charset. The differentiator:
//    TypeBox cannot express these at all; the others fall back to closures.
// ---------------------------------------------------------------------------
const comment = { author: 'neo_42', body: 'Really enjoyed this, thanks for sharing!', rating: 5 };
const tkComment = t.object({ author: t.string().minLength(3).maxLength(20).charset('a-z0-9_'), body: t.string().nonEmpty().maxLines(500).blockWords(BANNED), rating: t.int().min(1).max(5) });
const zComment = z.object({ author: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/), body: z.string().min(1).refine((s) => s.split('\n').length <= 500).refine((s) => { const l = s.toLowerCase(); return !BANNED.some((w) => l.includes(w)); }), rating: z.number().int().min(1).max(5) });
const vComment = v.object({ author: v.pipe(v.string(), v.minLength(3), v.maxLength(20), v.regex(/^[a-z0-9_]+$/)), body: v.pipe(v.string(), v.minLength(1), v.check((s) => s.split('\n').length <= 500), v.check((s) => { const l = s.toLowerCase(); return !BANNED.some((w) => l.includes(w)); })), rating: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5)) });
const aComment = type({ author: '/^[a-z0-9_]+$/ & string >= 3 & string <= 20', body: type('string >= 1').narrow((s: string) => s.split('\n').length <= 500 && !BANNED.some((w) => s.toLowerCase().includes(w))), rating: '1 <= number.integer <= 5' });
const cp = pool(comment);
group('4) comment-rich (maxLines + blockWords) — TypeBox cannot express', () => {
	summary(() => {
		bench('typkit', () => do_not_optimize(tkComment.check(cp[i++ & 15])));
		bench('arktype(narrow)', () => do_not_optimize(aComment(cp[i++ & 15])));
		bench('zod(refine)', () => do_not_optimize(zComment.safeParse(cp[i++ & 15])));
		bench('valibot(check)', () => do_not_optimize(v.safeParse(vComment, cp[i++ & 15])));
	});
});

// ---------------------------------------------------------------------------
// 5) Array of 100 objects.
// ---------------------------------------------------------------------------
const products = Array.from({ length: 100 }, (_, k) => ({ id: k, name: 'Product ' + k, price: 9.99 + k, inStock: k % 2 === 0 }));
const tkList = t.array(t.object({ id: t.int().min(0), name: t.string().minLength(1), price: t.number().positive(), inStock: t.boolean() }));
const zList = z.array(z.object({ id: z.number().int().min(0), name: z.string().min(1), price: z.number().positive(), inStock: z.boolean() }));
const vList = v.array(v.object({ id: v.pipe(v.number(), v.integer(), v.minValue(0)), name: v.pipe(v.string(), v.minLength(1)), price: v.pipe(v.number(), v.minValue(0.01)), inStock: v.boolean() }));
const aList = type({ id: 'number.integer >= 0', name: 'string >= 1', price: 'number > 0', inStock: 'boolean' }).array();
const tbList = TypeCompiler.Compile(Type.Array(Type.Object({ id: Type.Integer({ minimum: 0 }), name: Type.String({ minLength: 1 }), price: Type.Number({ exclusiveMinimum: 0 }), inStock: Type.Boolean() })));
const lp = pool(products, 4);
group('5) api-list (array of 100 objects)', () => {
	summary(() => {
		bench('typkit', () => do_not_optimize(tkList.check(lp[i++ & 3])));
		bench('typebox', () => do_not_optimize(tbList.Check(lp[i++ & 3])));
		bench('arktype', () => do_not_optimize(aList(lp[i++ & 3])));
		bench('zod', () => do_not_optimize(zList.safeParse(lp[i++ & 3])));
		bench('valibot', () => do_not_optimize(v.safeParse(vList, lp[i++ & 3])));
	});
});

// ---------------------------------------------------------------------------
// 6) Discriminated union — O(1) tag dispatch (streaming/tagged messages).
// ---------------------------------------------------------------------------
const event = { type: 'click', x: 10, y: 20 };
const tkEvent = t.discriminatedUnion('type', [
	t.object({ type: t.literal('click'), x: t.number(), y: t.number() }),
	t.object({ type: t.literal('key'), code: t.string() }),
	t.object({ type: t.literal('scroll'), delta: t.number() }),
]);
const zEvent = z.discriminatedUnion('type', [z.object({ type: z.literal('click'), x: z.number(), y: z.number() }), z.object({ type: z.literal('key'), code: z.string() }), z.object({ type: z.literal('scroll'), delta: z.number() })]);
const vEvent = v.variant('type', [v.object({ type: v.literal('click'), x: v.number(), y: v.number() }), v.object({ type: v.literal('key'), code: v.string() }), v.object({ type: v.literal('scroll'), delta: v.number() })]);
const aEvent = type({ type: "'click'", x: 'number', y: 'number' }).or({ type: "'key'", code: 'string' }).or({ type: "'scroll'", delta: 'number' });
const ep = pool(event);
group('6) discriminated union (O(1) tag dispatch)', () => {
	summary(() => {
		bench('typkit', () => do_not_optimize(tkEvent.check(ep[i++ & 15])));
		bench('arktype', () => do_not_optimize(aEvent(ep[i++ & 15])));
		bench('zod', () => do_not_optimize(zEvent.safeParse(ep[i++ & 15])));
		bench('valibot', () => do_not_optimize(v.safeParse(vEvent, ep[i++ & 15])));
	});
});

await run({ print: _capturePrint });

// Auto-generate bench-results.md
const body = stripAnsi(_reportLines.join('\n')).trim();
await writeReport(body);
