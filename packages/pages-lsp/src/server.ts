import type { SchemaRegistry } from './types.js';
import { handleCompletion } from './completion.js';
import { computeDiagnostics } from './diagnostics.js';
import { handleHover } from './hover.js';

export interface ServerCapabilities {
  textDocumentSync: number;
  completionProvider: {
    resolveProvider: boolean;
    triggerCharacters: string[];
  };
  hoverProvider: boolean;
}

export interface Position {
  line: number;
  character: number;
}

export interface TextDocumentIdentifier {
  uri: string;
}

export interface DiagnosticsNotification {
  uri: string;
  diagnostics: Array<{
    range: { start: Position; end: Position };
    severity: number;
    message: string;
    source: string;
  }>;
}

export interface ServerHandler {
  capabilities: ServerCapabilities;
  onDidOpen(uri: string, text: string): DiagnosticsNotification;
  onDidChange(uri: string, text: string): DiagnosticsNotification;
  onDidClose(uri: string): void;
  onCompletion(uri: string, position: Position): Array<{
    label: string;
    kind: number;
    insertText?: string;
    detail?: string;
  }>;
  onHover(uri: string, position: Position): {
    contents: { kind: string; value: string };
    range?: { start: Position; end: Position };
  } | null;
}

export function initializeServer(registry: SchemaRegistry): ServerCapabilities {
  return {
    textDocumentSync: 1,
    completionProvider: {
      resolveProvider: false,
      triggerCharacters: [':', ' ', '-'],
    },
    hoverProvider: true,
  };
}

export function createServerHandler(registry: SchemaRegistry): ServerHandler {
  const documents = new Map<string, string>();

  function publishDiagnostics(uri: string, content: string): DiagnosticsNotification {
    const diags = computeDiagnostics(uri, content, registry);
    return {
      uri,
      diagnostics: diags.map(d => ({
        range: d.range,
        severity: d.severity,
        message: d.message,
        source: d.source,
      })),
    };
  }

  return {
    capabilities: initializeServer(registry),

    onDidOpen(uri: string, text: string) {
      documents.set(uri, text);
      return publishDiagnostics(uri, text);
    },

    onDidChange(uri: string, text: string) {
      documents.set(uri, text);
      return publishDiagnostics(uri, text);
    },

    onDidClose(uri: string) {
      documents.delete(uri);
    },

    onCompletion(uri: string, position: Position) {
      const content = documents.get(uri) ?? '';
      return handleCompletion(uri, content, position, registry);
    },

    onHover(uri: string, position: Position) {
      const content = documents.get(uri) ?? '';
      const result = handleHover(uri, content, position, registry);
      if (!result) return null;
      return {
        contents: { kind: 'markdown', value: result.contents },
        ...(result.range ? { range: result.range } : {}),
      };
    },
  };
}
