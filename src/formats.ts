/**
 * Precompiled format regexes, compiled once at module load and shared by every
 * string node that requests a format. `creditCard` and `json` are validated by
 * inline code instead (see the string node), since a Luhn loop and `JSON.parse`
 * express the rule more precisely than a regex.
 */

/** Built-in string formats with a regex backing. */
export const FORMATS = {
	email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
	url: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
	slug: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
	ipv4: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
	ipv6: /^(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$|^(?:[0-9a-f]{1,4}:)+:(?:[0-9a-f]{1,4}:)*[0-9a-f]{1,4}$|^::(?:[0-9a-f]{1,4}:)*[0-9a-f]{1,4}$|^(?:[0-9a-f]{1,4}:)+:$/i,
	ip: /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$|^(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}$/i,
	datetime: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
	date: /^\d{4}-\d{2}-\d{2}$/,
	time: /^\d{2}:\d{2}:\d{2}(?:\.\d+)?$/,
	base64: /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
	hex: /^[0-9a-f]+$/i,
	semver: /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/,
	e164: /^\+[1-9]\d{1,14}$/,
} as const;

/** Formats backed by inline codegen rather than a regex. */
export const INLINE_FORMATS = ['json', 'creditCard'] as const;

/** Name of any supported string format. */
export type FormatName = keyof typeof FORMATS | (typeof INLINE_FORMATS)[number];
