export interface GridProps {
  readonly columns: number;
}

export interface ColumnsProps {
  readonly distribution: readonly number[];
}

export type RowsProps = Record<string, never>;
export type StackProps = Record<string, never>;

export type TabsProps = Record<string, never>;
export type PillsProps = Record<string, never>;
export type SidebarProps = Record<string, never>;
export type TreeProps = Record<string, never>;
export type MenuProps = Record<string, never>;
export type AccordionProps = Record<string, never>;
export type CarouselProps = Record<string, never>;
export type AppGridProps = Record<string, never>;

export interface PanelProps {
  readonly title: string;
}

export interface HtmlProps {
  readonly content: string;
}

export interface MarkdownProps {
  readonly content: string;
}

export interface TitleProps {
  readonly text: string;
  readonly size?: string;
}

export interface LazyPageProps {
  readonly name: string;
  readonly href: string;
}

export interface FilterSettings {
  readonly enabled?: boolean;
  readonly notification?: boolean;
  readonly listening?: boolean;
  readonly selfApply?: boolean;
  readonly group?: string;
  readonly drillDown?: DrillDown;
}

export interface DrillDown {
  readonly target: string;
  readonly parameters?: Readonly<Record<string, string>>;
}

export interface RefreshSettings {
  readonly interval?: number;
  readonly showStaleIndicator?: boolean;
}
