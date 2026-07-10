import type { TemplateResult } from 'lit';

export type DisplayMode = 'auto' | 'paginated' | 'scroll';
export type SelectionMode = 'none' | 'single' | 'multi';
export type SortDirection = 'asc' | 'desc' | 'none';
export type ColumnAlign = 'start' | 'center' | 'end';

export interface ColumnDef<R = unknown> {
  readonly id: string;
  readonly label: string;
  readonly type?: 'text' | 'number' | 'date';
  readonly getValue: (row: R) => unknown;
  readonly render?: (value: unknown, row: R) => TemplateResult | string;
  readonly compare?: (a: unknown, b: unknown) => number;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly filterValue?: (row: R) => string;
  readonly visible?: boolean;
  readonly width?: string;
  readonly minWidth?: string;
  readonly align?: ColumnAlign;
}

export interface SortEntry {
  readonly columnId: string;
  readonly direction: SortDirection;
}

export interface SortChangeDetail {
  readonly columnId: string;
  readonly direction: SortDirection;
  readonly sortStack: readonly SortEntry[];
}

export interface PageChangeDetail {
  readonly page: number;
  readonly pageSize: number;
}

export interface SelectionChangeDetail<R = unknown> {
  readonly selectedKeys: readonly string[];
  readonly selectedRows: readonly R[];
  readonly scope?: 'page';
}

export interface ColumnChangeDetail {
  readonly visibleColumns: readonly string[];
}

export interface RowActivateDetail<R = unknown> {
  readonly row: R;
  readonly key?: string;
}

export interface FilterChangeDetail {
  readonly text: string;
  readonly matchCount: number;
}

export interface LoadMoreDetail {}
