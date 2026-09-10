import { dashboardSchema } from '@casehubio/pages-schema';
import type { FormatRegistration } from '../types.js';

export const pageFormat: FormatRegistration = {
  formatId: 'page',
  extensions: ['.page.yaml', '.dash.yaml'],
  contentDetector: (inspector) =>
    inspector.hasKey(['pages']) || inspector.hasKey(['datasets']),
  documentSchema: dashboardSchema,
};
