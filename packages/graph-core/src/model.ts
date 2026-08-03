export interface GraphNode {
  readonly id: string;
  readonly type: string;
  readonly parentId?: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface GraphEdge {
  readonly id: string;
  readonly type: string;
  readonly source: string;
  readonly target: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface GraphModel {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}
