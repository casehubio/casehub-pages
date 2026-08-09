export interface Component<
  T extends string = string,
  P extends object = Record<string, unknown>,
> {
  readonly type: T;
  readonly id?: string;
  readonly props?: Readonly<P>;
  readonly style?: Readonly<Record<string, string>>;
  readonly access?: AccessControl;
  readonly visibleWhen?: string;
  readonly slots?: Readonly<Record<string, readonly Component[]>>;
  readonly items?: readonly GridItem[];
}

export interface AccessControl {
  readonly roles?: readonly string[];
  readonly permissions?: readonly string[];
}

export interface GridPlacement {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface GridItem {
  readonly placement: GridPlacement;
  readonly component: Component;
}

export interface PermissionContext {
  hasRole(role: string): boolean;
  hasPermission(permission: string): boolean;
}

export const ALLOW_ALL: PermissionContext = {
  hasRole: () => true,
  hasPermission: () => true,
};

export type DockZone =
  | "left-top" | "left-bottom"
  | "right-top" | "right-bottom"
  | "bottom-left" | "bottom-right";

export type DockSide = "left" | "right" | "bottom";

export interface PanelEntry {
  readonly typeName: string;
  readonly props?: Readonly<Record<string, unknown>>;
}

export interface LayoutState {
  readonly splits: Readonly<Record<string, readonly number[]>>;
  readonly docks: Readonly<Record<string, boolean>>;
  readonly panels: Readonly<Record<string, PanelEntry>>;
  readonly zones?: Readonly<Record<string, DockZone>>;
}
