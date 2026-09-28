const fs = require('fs');
const path = require('path');

const samplesDir = path.join(__dirname, '../samples');
const outputFile = path.join(__dirname, '../samples.json');

const CATEGORY_ORDER = [
  'Charts',
  'Tables',
  'Metrics',
  'Maps',
  'Forms',
  'Layout',
  'Interactivity',
  'Graph Editing',
  'Live Data',
  'Content',
  'Custom Components',
  'Theming',
  'Monitoring',
  'Scenarios',
  'Domain Showcases',
  'Server',
];

const SERVER_CATEGORIES = new Set(['Server']);

const DISPLAY_NAMES = {
};

const SAMPLE_TAGS = {
  'Charts/Charts.page.yaml': ['echarts', 'bar', 'line', 'pie', 'scatter'],
  'Charts/Decal Pattern.page.yaml': ['echarts', 'accessibility', 'pattern'],
  'Charts/Density Heatmap.page.yaml': ['echarts', 'heatmap', 'density'],
  'Charts/ECharts Custom.page.yaml': ['echarts', 'custom option'],
  'Charts/Event Timeline.page.yaml': ['echarts', 'timeline'],
  'Charts/Heatmap.page.yaml': ['echarts', 'heatmap'],
  'Charts/Histogram.page.yaml': ['echarts', 'histogram'],
  'Charts/SPI Broadening.page.yaml': ['echarts', 'line', 'area'],
  'Charts/Timeline and Graph.page.yaml': ['echarts', 'timeline', 'graph'],
  'Charts/TimeSeries.page.yaml': ['echarts', 'time series'],
  'Charts/Treemap.page.yaml': ['echarts', 'treemap'],
  'Tables/Accumulate Flag.page.yaml': ['table', 'accumulate', 'flag'],
  'Tables/Column Settings.page.yaml': ['table', 'columns', 'settings'],
  'Tables/Data Table.page.yaml': ['table', 'data table'],
  'Tables/GitHub Repos.page.yaml': ['table', 'fetch', 'rest api'],
  'Tables/Google Spreadsheet.page.yaml': ['table', 'google sheets'],
  'Tables/Grid Tables.page.yaml': ['table', 'grid layout'],
  'Tables/Grouped Roadmap.page.yaml': ['table', 'grouping', 'roadmap'],
  'Tables/Grouped View.page.yaml': ['table', 'grouping'],
  'Tables/Inline Dataset.page.yaml': ['table', 'inline data'],
  'Tables/Lookup Operations.page.yaml': ['table', 'lookup', 'filter', 'group'],
  'Tables/Master Detail.page.yaml': ['table', 'master-detail'],
  'Tables/Project Roadmap.page.yaml': ['table', 'roadmap', 'row styles'],
  'Tables/Row Detail.page.yaml': ['table', 'row expansion'],
  'Tables/Row Styles.page.yaml': ['table', 'conditional styles'],
  'Tables/Spanning.page.yaml': ['table', 'column spanning'],
  'Tables/Tabbed Table.page.yaml': ['table', 'tabs', 'navigation'],
  'Tables/Tree Table.page.yaml': ['table', 'tree', 'hierarchy'],
  'Tables/Variable Heights.page.yaml': ['table', 'variable height'],
  'Metrics/Badges and Countdown.page.yaml': ['metric', 'badge', 'countdown'],
  'Metrics/Metric Patterns.page.yaml': ['metric', 'patterns', 'layout'],
  'Metrics/Metrics and Gauges.page.yaml': ['metric', 'gauge'],
  'Maps/Maps.page.yaml': ['map', 'leaflet', 'geospatial'],
  'Maps/SVG Heatmap.page.yaml': ['map', 'svg', 'heatmap'],
  'Forms/Contact Manager.page.yaml': ['form', 'crud', 'data scope'],
  'Forms/Developer Registration.page.yaml': ['form', 'input', 'validation'],
  'Forms/Schema Form.page.yaml': ['form', 'json schema', 'dynamic'],
  'Layout/Carousel and Stack.page.yaml': ['layout', 'carousel', 'stack'],
  'Layout/Column with Rows.page.yaml': ['layout', 'columns', 'rows'],
  'Layout/Dock Workbench.page.yaml': ['layout', 'dock', 'workbench'],
  'Layout/Floating Workspace.page.yaml': ['layout', 'floating', 'windows'],
  'Layout/Frame Sandbox.page.yaml': ['layout', 'frame', 'sandbox'],
  'Layout/Layout Patterns.page.yaml': ['layout', 'patterns', 'responsive'],
  'Layout/Split and Dock.page.yaml': ['layout', 'split', 'dock'],
  'Layout/Team Management.page.yaml': ['layout', 'tabs', 'form'],
  'Layout/Workspace Compositor.page.yaml': ['layout', 'compositor', 'zones'],
  'Interactivity/Action Button.page.yaml': ['button', 'action', 'event'],
  'Interactivity/Dynamic Visibility.page.yaml': ['visibility', 'conditional'],
  'Interactivity/Navigation Rebinding.page.yaml': ['navigation', 'tree', 'tabs', 'menu'],
  'Interactivity/Selectors and Filters.page.yaml': ['selector', 'filter', 'variable'],
  'Graph Editing/Basic Pipeline.page.yaml': ['graph', 'pipeline', 'dag'],
  'Graph Editing/Interactive Editing.page.yaml': ['graph', 'editing', 'drag-drop'],
  'Graph Editing/Multi Select.page.yaml': ['graph', 'multi-select'],
  'Graph Editing/Nested Pipeline.page.yaml': ['graph', 'nested', 'subgraph'],
  'Live Data/Polling.page.yaml': ['polling', 'live data', 'refresh'],
  'Content/Alerts.page.yaml': ['alert', 'notification'],
  'Content/Content Types.page.yaml': ['html', 'markdown', 'content'],
  'Custom Components/Case Definition Editor.page.yaml': ['custom', 'editor', 'web component'],
  'Custom Components/Code Editor.page.yaml': ['custom', 'code editor', 'monaco'],
  'Custom Components/Iframe Components.page.yaml': ['custom', 'iframe', 'embed'],
  'Theming/DarkMode.page.yaml': ['theme', 'dark mode'],
  'Theming/Theme Designer.page.yaml': ['theme', 'designer', 'tokens'],
  'Theming/Theme Picker.page.yaml': ['theme', 'picker'],
  'Theming/Token Showcase.page.yaml': ['theme', 'design tokens'],
  'Monitoring/Ansible Metrics.page.yaml': ['monitoring', 'ansible', 'prometheus'],
  'Monitoring/Backstage Metrics.page.yaml': ['monitoring', 'backstage'],
  'Monitoring/Jupyter Hub Metrics.page.yaml': ['monitoring', 'jupyter', 'histogram'],
  'Monitoring/Jupyter Metrics Summary.page.yaml': ['monitoring', 'jupyter', 'summary'],
  'Monitoring/JVM Monitoring.page.yaml': ['monitoring', 'jvm', 'micrometer'],
  'Monitoring/Kepler Metrics.page.yaml': ['monitoring', 'kepler', 'energy'],
  'Monitoring/ModelMesh Metrics.page.yaml': ['monitoring', 'modelmesh', 'inference'],
  'Monitoring/OpenTelemetry Basic.page.yaml': ['monitoring', 'opentelemetry', 'traces'],
  'Monitoring/Prometheus Basic.page.yaml': ['monitoring', 'prometheus'],
  'Monitoring/Prometheus HTTP Requests.page.yaml': ['monitoring', 'prometheus', 'http'],
  'Monitoring/Quarkus Monitoring.page.yaml': ['monitoring', 'quarkus', 'micrometer'],
  'Monitoring/Real Time JVM Monitoring.page.yaml': ['monitoring', 'jvm', 'real-time'],
  'Monitoring/Triton Inference Server.page.yaml': ['monitoring', 'triton', 'inference'],
  'Scenarios/Composable Workflow.page.yaml': ['scenario', 'fill', 'select', 'click', 'composition'],
  'Scenarios/Composition.page.yaml': ['scenario', 'trigger', 'module', 'forEach'],
  'Scenarios/Coordination.page.yaml': ['scenario', 'signal', 'barrier', 'mutex', 'concurrent'],
  'Scenarios/Data Delivery.page.yaml': ['scenario', 'simulated', 'graphql', 'data injection'],
  'Scenarios/Flow Control.page.yaml': ['scenario', 'loop', 'retry', 'timeout', 'when', 'delay'],
  'Scenarios/Form Automation.page.yaml': ['scenario', 'fill', 'select', 'assert', 'click'],
  'Scenarios/Parameterized Script.page.yaml': ['scenario', 'parameters', 'reuse'],
  'Scenarios/Scenario Controller.page.yaml': ['scenario', 'controller', 'playback'],
  'Scenarios/Script Library.page.yaml': ['scenario', 'library', 'search', 'labels'],
  'Scenarios/Step Workflows.page.yaml': ['step', 'if-else', 'match', 'try-catch', 'barrier', 'quorum', 'parallel'],
  'Scenarios/Table Population.page.yaml': ['scenario', 'fill', 'click', 'data injection'],
  'Domain Showcases/FIFA 2022 Goals.page.yaml': ['showcase', 'sports', 'charts'],
  'Domain Showcases/Fleet Monitor.page.yaml': ['showcase', 'iot', 'monitoring'],
  'Domain Showcases/Github Repositories.page.yaml': ['showcase', 'github', 'api'],
  'Domain Showcases/Most Spoken Languages.page.yaml': ['showcase', 'chart', 'data'],
  'Domain Showcases/Patient Tracker.page.yaml': ['showcase', 'clinical', 'tracker'],
  'Domain Showcases/Podman Stats.page.yaml': ['showcase', 'containers', 'podman'],
  'Domain Showcases/Sales Dashboard.page.yaml': ['showcase', 'sales', 'metrics'],
  'Domain Showcases/Workforce Analytics.page.yaml': ['showcase', 'hr', 'analytics'],
  'Server/Live Event Stream.page.yaml': ['server', 'sse', 'streaming'],
  'Server/Multi-Topic Dashboard.page.yaml': ['server', 'multi-topic', 'sse'],
  'Server/Prometheus Metrics.page.yaml': ['server', 'prometheus', 'push'],
  'Server/Reconnect Replay.page.yaml': ['server', 'reconnect', 'replay'],
};

// Recursively find all sample files
function findSamples(dir, baseDir = dir) {
  const files = fs.readdirSync(dir);
  const samples = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file === 'includes') continue;
      samples.push(...findSamples(filePath, baseDir));
    } else if (file.endsWith('.page.yaml') || file.endsWith('.dash.yml') || file.endsWith('.yml') || file.endsWith('.yaml')) {
      const relativePath = path.relative(baseDir, filePath);
      const name = file.replace(/\.(page\.yaml|page\.yml|dash\.yaml|dash\.yml|yml|yaml)$/, '');
      const category = path.dirname(relativePath).split(path.sep)[0];

      const relPath = relativePath.split(path.sep).join('/');
      const entry = {
        name: name,
        path: relPath,
        category: category === '.' ? 'General' : category,
        file: file
      };

      if (SAMPLE_TAGS[relPath]) {
        entry.tags = SAMPLE_TAGS[relPath];
      }

      const baseName = name.replace(/\.page$/, '');
      const tsCompanion = path.join(dir, baseName + '.ts');
      if (fs.existsSync(tsCompanion)) {
        entry.tsPath = path.relative(baseDir, tsCompanion).split(path.sep).join('/');
      }

      samples.push(entry);
    }
  }

  return samples;
}

// Generate the samples.json
const samples = findSamples(samplesDir);

// Group by category
const categories = {};
samples.forEach(sample => {
  if (!categories[sample.category]) {
    categories[sample.category] = [];
  }
  categories[sample.category].push(sample);
});

// Sort categories: explicit order first, then remaining alphabetically
const knownKeys = CATEGORY_ORDER.filter(k => categories[k]);
const unknownKeys = Object.keys(categories).filter(k => !CATEGORY_ORDER.includes(k)).sort();
const sortedCategories = [...knownKeys, ...unknownKeys];

const categorized = sortedCategories.map(category => {
  const entry = {
    category: DISPLAY_NAMES[category] || category,
    samples: categories[category].sort((a, b) => a.name.localeCompare(b.name)).map(s => {
      if (DISPLAY_NAMES[s.category]) {
        return { ...s, category: DISPLAY_NAMES[s.category] };
      }
      return s;
    })
  };
  if (SERVER_CATEGORIES.has(category)) {
    entry.requiresServer = true;
  }
  return entry;
});

const output = {
  version: '2.0.0',
  description: 'CaseHub Pages Examples Gallery',
  totalSamples: samples.length,
  categories: categorized
};

fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
console.log(`Generated samples.json with ${samples.length} samples in ${sortedCategories.length} categories`);
