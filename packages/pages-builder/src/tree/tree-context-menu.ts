import type { MenuItem } from '@casehubio/pages-primitives';
import type { TreeNodeType } from './builder-tree.js';

export function computeMenuItems(nodeType: TreeNodeType, isContainer: boolean): MenuItem[] {
  switch (nodeType) {
    case 'component':
      return [
        ...(isContainer ? [{ label: 'Add child', action: 'add-child' }] : []),
        { label: 'Move up', action: 'move-up' },
        { label: 'Move down', action: 'move-down' },
        { separator: true, label: '' },
        { label: 'Wrap in Tabs', action: 'wrap-tabs' },
        { separator: true, label: '' },
        { label: 'Duplicate', action: 'duplicate', shortcut: '⌃D' },
        { label: 'Delete', action: 'delete', shortcut: '⌫' },
      ];
    case 'grid-item':
      return [
        { label: 'Move up', action: 'move-up' },
        { label: 'Move down', action: 'move-down' },
        { separator: true, label: '' },
        { label: 'Delete', action: 'delete', shortcut: '⌫' },
      ];
    case 'page':
      return [
        { label: 'Add item', action: 'add-item' },
        { label: 'Add component', action: 'add-child' },
        { separator: true, label: '' },
        { label: 'Delete', action: 'delete', shortcut: '⌫' },
      ];
    case 'dataset':
      return [
        { label: 'Duplicate', action: 'duplicate', shortcut: '⌃D' },
        { label: 'Delete', action: 'delete', shortcut: '⌫' },
      ];
    default:
      return [];
  }
}
