/**
 * Minimal JSON Schema (draft 2020-12 compatible) type used by `toJsonSchema()`.
 *
 * The config-object API maps almost 1:1 onto JSON Schema, so each node produces
 * its fragment directly. Frameworks like Elysia read this to generate OpenAPI /
 * Swagger documents from a TypKit schema with no extra wiring.
 */
export interface JsonSchema {
	type?: string | string[];
	format?: string;
	properties?: Record<string, JsonSchema>;
	required?: string[];
	items?: JsonSchema | JsonSchema[];
	additionalProperties?: boolean | JsonSchema;
	enum?: ReadonlyArray<string | number | boolean | null>;
	const?: unknown;
	anyOf?: JsonSchema[];
	allOf?: JsonSchema[];
	oneOf?: JsonSchema[];
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: number;
	exclusiveMaximum?: number;
	multipleOf?: number;
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	minItems?: number;
	maxItems?: number;
	uniqueItems?: boolean;
	default?: unknown;
	nullable?: boolean;
	description?: string;
	[key: string]: unknown;
}
