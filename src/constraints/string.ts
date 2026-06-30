/**
 * Inline-compiled string constraints. Every rule here emits literal expressions
 * or loops — never a closure — so the V8/JSC optimizer sees one monomorphic
 * function. The `maxLines` / `blockWords` / `charset` rules are the differentiator:
 * competitors express them with `.refine()/.check()`, which cannot be inlined.
 */

import type { Emitter } from '../compiler.js';
import { FORMATS, type FormatName } from '../formats.js';

/** Options accepted by `t.string()` and the format shortcuts. */
export interface StringOpts {
	minLength?: number;
	maxLength?: number;
	length?: number;
	nonEmpty?: boolean;
	pattern?: RegExp;
	charset?: string;
	maxLines?: number;
	startsWith?: string;
	endsWith?: string;
	includes?: string;
	allowedWords?: string[];
	blockWords?: string[];
	/** Reject leading/trailing whitespace (validation only — does not mutate). */
	trim?: boolean;
	format?: FormatName;
}

/** Emit every constraint in `o` for the already-typechecked string `src`. */
export function emitStringConstraints(e: Emitter, src: string, path: string, o: StringOpts): void {
	if (o.nonEmpty) e.check(`${src}.length===0`, 'must not be empty', path);
	if (o.minLength != null) e.check(`${src}.length<${o.minLength}`, `must be at least ${o.minLength} characters`, path);
	if (o.maxLength != null) e.check(`${src}.length>${o.maxLength}`, `must be at most ${o.maxLength} characters`, path);
	if (o.length != null) e.check(`${src}.length!==${o.length}`, `must be exactly ${o.length} characters`, path);
	if (o.trim) e.check(`${src}!==${src}.trim()`, 'must not have leading or trailing whitespace', path);
	if (o.startsWith != null) e.check(`!${src}.startsWith(${JSON.stringify(o.startsWith)})`, `must start with ${JSON.stringify(o.startsWith)}`, path);
	if (o.endsWith != null) e.check(`!${src}.endsWith(${JSON.stringify(o.endsWith)})`, `must end with ${JSON.stringify(o.endsWith)}`, path);
	if (o.includes != null) e.check(`${src}.indexOf(${JSON.stringify(o.includes)})<0`, `must include ${JSON.stringify(o.includes)}`, path);

	if (o.charset != null) {
		const re = new RegExp(`^[${o.charset}]*$`);
		e.check(`!${e.ref(re)}.test(${src})`, `must contain only [${o.charset}]`, path);
	}
	if (o.pattern != null) {
		e.check(`!${e.ref(o.pattern)}.test(${src})`, `must match ${o.pattern}`, path);
	}
	if (o.format != null) emitFormat(e, src, path, o.format);

	if (o.maxLines != null) {
		// Inline newline scan — O(n), zero allocation. The canonical rule that
		// competitors cannot inline through a refinement closure.
		const lc = e.freshVar();
		const k = e.freshVar();
		e.line(`var ${lc}=1;for(var ${k}=0;${k}<${src}.length;${k}++){if(${src}.charCodeAt(${k})===10)${lc}++;}`);
		e.check(`${lc}>${o.maxLines}`, `must be at most ${o.maxLines} lines`, path);
	}

	if (o.blockWords && o.blockWords.length) {
		const lw = e.freshVar();
		e.line(`var ${lw}=${src}.toLowerCase();`);
		const cond = o.blockWords.map((w) => `${lw}.indexOf(${JSON.stringify(w.toLowerCase())})>=0`).join('||');
		e.check(cond, 'contains a blocked word', path);
	}

	if (o.allowedWords && o.allowedWords.length) {
		// Tokenize on whitespace and verify every token is allowed. Inline loop,
		// allocation only on the failure branch (the split happens lazily).
		const set = new Set(o.allowedWords.map((w) => w.toLowerCase()));
		const toks = e.freshVar();
		const j = e.freshVar();
		const allow = e.ref(set);
		e.line(`var ${toks}=${src}.toLowerCase().split(/\\s+/);`);
		e.line(`for(var ${j}=0;${j}<${toks}.length;${j}++){if(${toks}[${j}]&&!${allow}.has(${toks}[${j}])){${e.fail('contains a disallowed word', path)}}}`);
	}
}

function emitFormat(e: Emitter, src: string, path: string, format: FormatName): void {
	if (format === 'json') {
		const ok = e.freshVar();
		e.line(`var ${ok}=true;try{JSON.parse(${src});}catch(_e){${ok}=false;}`);
		e.check(`!${ok}`, 'must be valid JSON', path);
		return;
	}
	if (format === 'creditCard') {
		// Luhn checksum, inline. Rejects non-digits and bad checksums in one pass.
		const sum = e.freshVar();
		const alt = e.freshVar();
		const i = e.freshVar();
		const d = e.freshVar();
		const bad = e.freshVar();
		e.line(`var ${sum}=0,${alt}=false,${bad}=${src}.length<12||${src}.length>19;`);
		e.line(`for(var ${i}=${src}.length-1;${i}>=0&&!${bad};${i}--){var ${d}=${src}.charCodeAt(${i})-48;if(${d}<0||${d}>9){${bad}=true;break;}if(${alt}){${d}*=2;if(${d}>9)${d}-=9;}${sum}+=${d};${alt}=!${alt};}`);
		e.check(`${bad}||${sum}%10!==0`, 'must be a valid card number', path);
		return;
	}
	e.check(`!${e.ref(FORMATS[format])}.test(${src})`, `must be a valid ${format}`, path);
}

/** Contribute string constraints to a JSON Schema fragment. */
export function stringJsonSchema(o: StringOpts): Record<string, unknown> {
	const s: Record<string, unknown> = {};
	if (o.minLength != null) s.minLength = o.minLength;
	if (o.nonEmpty) s.minLength = Math.max(1, (s.minLength as number) ?? 1);
	if (o.maxLength != null) s.maxLength = o.maxLength;
	if (o.length != null) {
		s.minLength = o.length;
		s.maxLength = o.length;
	}
	if (o.format && o.format in FORMATS) s.format = jsonFormatName(o.format);
	if (o.pattern != null) s.pattern = o.pattern.source;
	if (o.charset != null) s.pattern = `^[${o.charset}]*$`;
	return s;
}

function jsonFormatName(format: FormatName): string {
	if (format === 'datetime') return 'date-time';
	if (format === 'ipv4') return 'ipv4';
	if (format === 'ipv6') return 'ipv6';
	return format;
}
