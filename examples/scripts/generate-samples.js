const fs = require('fs');
const path = require('path');

const dashboardsDir = path.join(__dirname, '../dashboards');
const outputFile = path.join(__dirname, '../samples.json');

const CATEGORY_ORDER = [
  'Sales',
  'Clinical',
  'IoT',
  'People',
  'Prometheus',
  'Micrometer',
  'ansible',
  'jupyterhub',
  'kepler',
  'OpenTelemetry',
  'modelmesh',
  'triton',
  'Backstage',
  'misc',
  'Basic Usage',
];

const DISPLAY_NAMES = {
  'ansible': 'Ansible',
  'jupyterhub': 'JupyterHub',
  'kepler': 'Kepler',
  'misc': 'Misc',
  'modelmesh': 'ModelMesh',
  'triton': 'Triton',
};

// Recursively find all dashboard files
function findDashboards(dir, baseDir = dir) {
  const files = fs.readdirSync(dir);
  const dashboards = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file === 'includes') continue;
      dashboards.push(...findDashboards(filePath, baseDir));
    } else if (file.endsWith('.dash.yaml') || file.endsWith('.dash.yml') || file.endsWith('.yml') || file.endsWith('.yaml')) {
      const relativePath = path.relative(baseDir, filePath);
      const name = file.replace(/\.(dash\.yaml|dash\.yml|yml|yaml)$/, '');
      const category = path.dirname(relativePath).split(path.sep)[0];

      dashboards.push({
        name: name,
        path: relativePath.replace(/\\/g, '/'),
        category: category === '.' ? 'General' : category,
        file: file
      });
    }
  }

  return dashboards;
}

// Generate the samples.json
const dashboards = findDashboards(dashboardsDir);

// Group by category
const categories = {};
dashboards.forEach(dashboard => {
  if (!categories[dashboard.category]) {
    categories[dashboard.category] = [];
  }
  categories[dashboard.category].push(dashboard);
});

// Sort categories: explicit order first, then remaining alphabetically
const knownKeys = CATEGORY_ORDER.filter(k => categories[k]);
const unknownKeys = Object.keys(categories).filter(k => !CATEGORY_ORDER.includes(k)).sort();
const sortedCategories = [...knownKeys, ...unknownKeys];

const samples = sortedCategories.map(category => ({
  category: DISPLAY_NAMES[category] || category,
  dashboards: categories[category].sort((a, b) => a.name.localeCompare(b.name))
}));

const output = {
  version: '1.0.0',
  description: 'Melviz Dashboard Examples',
  totalDashboards: dashboards.length,
  categories: samples
};

fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
console.log(`Generated samples.json with ${dashboards.length} dashboards in ${sortedCategories.length} categories`);
