export interface PaletteContext {
  parentType: string | undefined;
  parentSlot?: string | undefined;
  acceptsComponents: boolean;
  availableDatasets: string[];
  siblingTypes: string[];
}

export type ContextRelevance = 'promoted' | 'normal' | 'hidden' | 'needs-prereq';
