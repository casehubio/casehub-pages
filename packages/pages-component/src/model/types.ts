export interface Component<
  T extends string = string,
  P extends object = Record<string, unknown>,
> {
  readonly type: T;
  readonly id?: string;
  readonly props?: Readonly<P>;
  readonly style?: Readonly<Record<string, string>>;
  readonly access?: AccessControl;
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
