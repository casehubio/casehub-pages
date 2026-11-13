export interface ParsedAnnotation {
  name: string;
  args: Record<string, string>;
  line: number;
}

const ANNOTATION_RE = /^\s*#@(\w+)(?:\(([^)]*)\))?\s*$/;

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Preserve the published static facade.
export class AnnotationParser {
  static parse(rawYaml: string): ParsedAnnotation[] {
    const annotations: ParsedAnnotation[] = [];
    const lines = rawYaml.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const match = ANNOTATION_RE.exec(lines[i]!);
      if (!match) continue;
      const name = match[1]!;
      const argsStr = match[2];
      const args = argsStr ? AnnotationParser.parseArgs(argsStr) : {};
      annotations.push({ name, args, line: i });
    }
    return annotations;
  }

  private static parseArgs(argsStr: string): Record<string, string> {
    const args: Record<string, string> = {};
    const tokens = AnnotationParser.tokenizeArgs(argsStr);
    let positionalIndex = 0;
    for (const token of tokens) {
      const colonIdx = token.indexOf(':');
      if (colonIdx > 0 && !token.startsWith('"') && !token.startsWith("'")) {
        const key = token.substring(0, colonIdx).trim();
        const value = AnnotationParser.unquote(token.substring(colonIdx + 1).trim());
        args[key] = value;
      } else {
        args[String(positionalIndex)] = AnnotationParser.unquote(token.trim());
        positionalIndex++;
      }
    }
    return args;
  }

  private static tokenizeArgs(argsStr: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote: string | null = null;
    for (const ch of argsStr) {
      if (inQuote) {
        current += ch;
        if (ch === inQuote) inQuote = null;
      } else if (ch === '"' || ch === "'") {
        current += ch;
        inQuote = ch;
      } else if (ch === ',') {
        if (current.trim()) tokens.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) tokens.push(current.trim());
    return tokens;
  }

  private static unquote(s: string): string {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
  }
}
