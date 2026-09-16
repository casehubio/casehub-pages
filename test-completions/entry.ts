import { createSchemaCompletion } from '@casehubio/pages-code-editor';
import { dashboardSchema } from '@casehubio/pages-schema';
import { yamlCoreDocumentSchema } from '@casehubio/yaml-core/schema';
import { z } from 'zod';

const pageDocumentSchema = z.intersection(yamlCoreDocumentSchema, dashboardSchema);

const editor = document.getElementById('editor')!;
const schemaExt = createSchemaCompletion(pageDocumentSchema);

import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { EditorState, type Extension } from '@codemirror/state';
import { yaml } from '@codemirror/lang-yaml';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';

const sampleYaml = `pages:
- name: index
  rows:
  - columns:
    - span: 6
      components:
      - type: metric
        properties:
          title: Revenue
          value: "$48,200"
    - span: 6
      components:
      - type: bar-chart
        properties:
          chart:
            title: Monthly Sales
          lookup:
            uuid: sales
datasets:
- uuid: sales
  url: https://api.example.com/data
`;

const state = EditorState.create({
  doc: sampleYaml,
  extensions: [
    lineNumbers(),
    drawSelection(),
    history(),
    yaml(),
    indentUnit.of('  '),
    keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
    schemaExt,
    EditorView.theme({
      '&': { height: '100%', fontSize: '14px', fontFamily: 'monospace', backgroundColor: '#1e1e1e', color: '#d4d4d4' },
      '.cm-scroller': { overflow: 'auto' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#fff', borderLeftWidth: '2px' },
      '.cm-gutters': { backgroundColor: '#1e1e1e', color: '#858585', borderRight: '1px solid #333' },
      '.cm-activeLine': { backgroundColor: '#2a2a2a' },
      '& .cm-tooltip.cm-tooltip-autocomplete': { backgroundColor: '#252526', color: '#d4d4d4', border: '1px solid #454545' },
      '& .cm-tooltip.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: '#04395e', color: '#fff' },
    }),
  ],
});

new EditorView({ state, parent: editor });
