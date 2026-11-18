export interface PlaybookFrontMatter {
  version: string;
  schema: string;
  name?: string;
  metadata: Record<string, unknown>;
}

export interface PlaybookDocument {
  frontMatter: PlaybookFrontMatter | null;
  content: Record<string, unknown>;
}

export const PLAYBOOK_SCHEMAS = {
  CLIENT: 'client',
  SERVER: 'server',
  ASSISTED: 'assisted',
} as const;

export function isBuiltInSchema(schema: string): boolean {
  return schema === PLAYBOOK_SCHEMAS.CLIENT
    || schema === PLAYBOOK_SCHEMAS.SERVER
    || schema === PLAYBOOK_SCHEMAS.ASSISTED;
}

export function isDomainSchema(schema: string | null | undefined): boolean {
  return schema != null && schema.includes('-') && !isBuiltInSchema(schema);
}

export interface TutorialHeaders {
  level: number;
  layer: string;
  teaches: string;
  buildsOn: string | string[] | null;
}

export function parseTutorialHeaders(meta: Record<string, unknown>): TutorialHeaders {
  return {
    level: meta['level'] as number,
    layer: meta['layer'] as string,
    teaches: meta['teaches'] as string,
    buildsOn: (meta['builds-on'] as string | string[] | undefined) ?? null,
  };
}

export function validateTutorialHeaders(meta: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (meta['level'] == null) {
    errors.push("Missing required tutorial header: 'level'");
  } else {
    const level = meta['level'] as number;
    if (level < 1 || level > 5) {
      errors.push(`Tutorial header 'level' must be 1-5, got ${level}`);
    }
  }
  if (meta['layer'] == null) errors.push("Missing required tutorial header: 'layer'");
  if (meta['teaches'] == null) errors.push("Missing required tutorial header: 'teaches'");
  return errors;
}

const PLAYBOOK_KEY = 'playbook';
const SCHEMA_KEY = 'schema';
const NAME_KEY = 'name';
const RESERVED_KEYS = new Set([PLAYBOOK_KEY, SCHEMA_KEY, NAME_KEY]);

export function parsePlaybookFrontMatter(
  firstDoc: Record<string, unknown>,
): PlaybookFrontMatter | null {
  if (!(PLAYBOOK_KEY in firstDoc)) return null;

  const version = String(firstDoc[PLAYBOOK_KEY]);
  const schema = firstDoc[SCHEMA_KEY];
  if (typeof schema !== 'string') {
    throw new Error("Playbook front matter requires a 'schema' field");
  }
  const name = typeof firstDoc[NAME_KEY] === 'string' ? firstDoc[NAME_KEY] : undefined;

  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(firstDoc)) {
    if (!RESERVED_KEYS.has(key)) {
      metadata[key] = value;
    }
  }

  return { version, schema, metadata, ...(name !== undefined && { name }) };
}
