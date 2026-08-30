import { readFileSync, writeFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { parse } from 'yaml';

const tutorialsDir = join(process.cwd(), 'tutorials');
const outputDir = join(process.cwd(), 'dist');
const outputPath = join(outputDir, 'tutorial-registry.json');

function scanTutorials() {
  if (!existsSync(tutorialsDir)) {
    console.log('No tutorials/ directory — writing empty registry');
    return [];
  }

  const entries = readdirSync(tutorialsDir).filter(e => {
    const stat = statSync(join(tutorialsDir, e));
    return stat.isDirectory() && e !== 'paths';
  });

  const descriptors = [];
  const errors = [];

  for (const dir of entries) {
    const yamlPath = join(tutorialsDir, dir, 'tutorial.yaml');
    if (!existsSync(yamlPath)) continue;

    const content = readFileSync(yamlPath, 'utf-8');
    const parsed = parse(content);

    if (!parsed.scenario) {
      errors.push(`${dir}: missing scenario name`);
      continue;
    }
    if (!parsed.meta) {
      errors.push(`${dir}: missing meta block`);
      continue;
    }

    const meta = parsed.meta;
    if (!meta.title || !meta.description || !meta.area) {
      errors.push(`${dir}: meta must have title, description, area`);
      continue;
    }

    for (const label of meta.labels ?? []) {
      if (!label.includes(':')) {
        errors.push(`${dir}: label "${label}" must be namespace:value`);
      }
    }

    const sections = parsed.sections;
    if (sections) {
      for (const sec of sections) {
        const secContent = sec.content;
        if (secContent?.type === 'template' && secContent.path) {
          const templatePath = join(tutorialsDir, dir, secContent.path);
          if (!existsSync(templatePath)) {
            errors.push(`${dir}: section "${sec.title}" references missing file: ${secContent.path}`);
          }
        }
      }
    }

    let contentType = 'slides-only';
    if (sections) {
      for (const sec of sections) {
        const steps = sec.steps;
        if (steps && steps.length > 0) { contentType = 'hands-on'; break; }
      }
    }

    descriptors.push({
      scenario: parsed.scenario,
      title: meta.title,
      description: meta.description,
      area: meta.area,
      labels: meta.labels ?? [],
      tags: meta.tags ?? [],
      estimated: meta.estimated,
      prerequisites: meta.prerequisites ?? [],
      path: `tutorials/${dir}/tutorial.yaml`,
      contentType,
      ...(meta.hero ? { hero: meta.hero } : {}),
    });
  }

  if (errors.length > 0) {
    console.error('Tutorial registry build errors:');
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  const seen = new Map();
  for (const d of descriptors) {
    if (seen.has(d.scenario)) {
      console.error(`Duplicate scenario name "${d.scenario}" in ${d.path} and ${seen.get(d.scenario)}`);
      process.exit(1);
    }
    seen.set(d.scenario, d.path);
  }

  for (const d of descriptors) {
    for (const prereq of d.prerequisites) {
      if (!seen.has(prereq)) {
        console.warn(`Warning: ${d.scenario} has prerequisite "${prereq}" not found in this registry`);
      }
    }
  }

  return descriptors;
}

const descriptors = scanTutorials();
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, JSON.stringify(descriptors, null, 2));
console.log(`Tutorial registry: ${descriptors.length} tutorial(s) → ${outputPath}`);
