export interface ViewerSyncTarget {
  syncLine(line: number): void;
}

export interface ViewerSelectDetail {
  line: number;
  endLine: number;
}

export function isViewerSyncTarget(el: unknown): el is ViewerSyncTarget {
  return (
    typeof el === 'object' &&
    el !== null &&
    typeof (el as ViewerSyncTarget).syncLine === 'function'
  );
}
