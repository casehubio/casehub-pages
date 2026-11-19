import { join } from 'node:path';
import { MapServiceRegistry } from '../step/walker.js';
import { CompositeCatalog } from '../step/catalog.js';
import { describeYamlTests } from './vitest-adapter.js';

const fixturesDir = join(import.meta.dirname, 'fixtures', 'categories');
const catalog = new CompositeCatalog([]);
const services = new MapServiceRegistry();

describeYamlTests(fixturesDir, catalog, services);
