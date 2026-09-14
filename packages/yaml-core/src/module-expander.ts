import type { YamlImport, YamlModule, YamlModuleOutput, VariableSource } from './types.js';
import { VariableResolver } from './variable-resolver.js';
import { ParameterValidator } from './parameter-validator.js';

const VAR_REF = /\$\{([^}]+)}/g;
const WHOLE_MODULE_REF = /^\s*\$\{module\.[^}]+}\s*$/;

export interface ExpandedModule {
  sections: Record<string, Record<string, unknown>>;
  moduleScopes: Record<string, Record<string, string>>;
  importConditions: Record<string, string>;
  moduleOutputs: Record<string, Record<string, string>>;
}

function buildModuleSource(
  allOutputs: Record<string, Record<string, string>>,
): VariableSource {
  return (name) => {
    const dot = name.indexOf('.');
    if (dot < 0) return undefined;
    const alias = name.substring(0, dot);
    const outputName = name.substring(dot + 1);
    const outputs = allOutputs[alias];
    return outputs?.[outputName];
  };
}

function canAccept(target: string, source: string): boolean {
  if (target === source) return true;
  if (target === 'STRING' && source !== 'LIST') return true;
  if (target === 'NUMBER' && source === 'INTEGER') return true;
  return false;
}

function validateImports(
  imports: YamlImport[],
  availableModules: Record<string, YamlModule>,
): void {
  const errors: string[] = [];
  const seenAliases = new Set<string>();

  for (const imp of imports) {
    if (!availableModules[imp.module]) {
      errors.push(`Import references unknown module '${imp.module}'.`);
    } else {
      validateOutputNames(availableModules[imp.module]!, errors);
    }

    if (!imp.as || imp.as.trim() === '') {
      errors.push(`Import of module '${imp.module}' is missing a required alias (as).`);
    } else {
      if (imp.as.includes('.')) {
        errors.push(`Import alias '${imp.as}' contains '.', which is reserved as the ID separator.`);
      }
      if (seenAliases.has(imp.as)) {
        errors.push(`Import alias '${imp.as}' is a duplicate — each import must have a unique alias.`);
      }
      seenAliases.add(imp.as);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Import validation failed: ${errors.join(' ')}`);
  }
}

function validateOutputNames(module: YamlModule, errors: string[]): void {
  for (const outputName of Object.keys(module.outputs)) {
    if (!outputName || outputName.trim() === '') {
      errors.push(`Module '${module.name}' has a blank output name.`);
    } else if (outputName.includes('.')) {
      errors.push(`Output '${outputName}' in module '${module.name}' contains '.', which is reserved as the alias/name separator.`);
    } else if (outputName.includes('${')) {
      errors.push(`Output '${outputName}' in module '${module.name}' contains '\${', which is reserved for variable references.`);
    }
  }
}

function validateModuleRefs(
  imports: YamlImport[],
  availableModules: Record<string, YamlModule>,
): void {
  const violations: Array<{ parameterName: string; constraint: string; message: string; actualValue: unknown; technicalDetail: string }> = [];
  const processedAliases = new Set<string>();

  for (const imp of imports) {
    const targetModule = availableModules[imp.module];
    if (!targetModule) {
      processedAliases.add(imp.as);
      continue;
    }

    for (const [paramName, paramValue] of Object.entries(imp.parameters)) {
      if (!paramValue.includes('${module.')) continue;

      const paramDecl = targetModule.parameters[paramName];
      const isWholeValue = WHOLE_MODULE_REF.test(paramValue);

      let match: RegExpExecArray | null;
      const regex = new RegExp(VAR_REF.source, 'g');
      while ((match = regex.exec(paramValue)) !== null) {
        const key = match[1]!;
        if (!key.startsWith('module.')) continue;
        const rest = key.substring('module.'.length);
        const dot = rest.indexOf('.');
        if (dot < 0) continue;
        const refAlias = rest.substring(0, dot);
        const outputName = rest.substring(dot + 1);

        if (!processedAliases.has(refAlias)) {
          violations.push({
            parameterName: paramName, constraint: 'module-ref-forward',
            message: `Import '${imp.as}' references \${${key}}, but '${refAlias}' has not been imported yet. Move the '${refAlias}' import before '${imp.as}'.`,
            actualValue: paramValue, technicalDetail: '',
          });
          continue;
        }

        const refModule = findModuleByAlias(refAlias, imports, availableModules);
        if (!refModule) continue;

        const output = refModule.outputs[outputName];
        if (!output) {
          violations.push({
            parameterName: paramName, constraint: 'module-ref-missing-output',
            message: `Import '${imp.as}' references output '${outputName}' on '${refAlias}', but module '${refModule.name}' does not declare that output. Available: ${Object.keys(refModule.outputs).join(', ')}`,
            actualValue: paramValue, technicalDetail: '',
          });
          continue;
        }

        if (isWholeValue && paramDecl) {
          if (!canAccept(paramDecl.type, output.type)) {
            violations.push({
              parameterName: paramName, constraint: 'module-ref-type-incompatible',
              message: `Output '${outputName}' (${output.type}) on '${refAlias}' is not assignable to parameter '${paramName}' (${paramDecl.type}).`,
              actualValue: paramValue, technicalDetail: '',
            });
          }
        }
      }

      if (!isWholeValue && paramDecl && paramDecl.type !== 'STRING') {
        violations.push({
          parameterName: paramName, constraint: 'module-ref-embedded-type',
          message: `Parameter '${paramName}' (${paramDecl.type}) uses string interpolation, which always produces STRING.`,
          actualValue: paramValue, technicalDetail: '',
        });
      }
    }
    processedAliases.add(imp.as);
  }

  if (violations.length > 0) {
    throw new Error(
      `Parameter validation failed with ${violations.length} violation(s): ` +
      violations.map((v) => `${v.parameterName} (${v.constraint})`).join(', '),
    );
  }
}

function findModuleByAlias(
  alias: string, imports: YamlImport[],
  availableModules: Record<string, YamlModule>,
): YamlModule | null {
  for (const imp of imports) {
    if (alias === imp.as) {
      return availableModules[imp.module] ?? null;
    }
  }
  return null;
}

function resolveParameters(
  module: YamlModule, imp: YamlImport,
  resolvedParams: Record<string, string>,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  for (const [name, param] of Object.entries(module.parameters)) {
    let value = resolvedParams[name];
    if (value === undefined && param.defaultValue !== undefined) {
      value = param.defaultValue;
    }
    if (value !== undefined) {
      resolved[name] = value;
    }
  }

  ParameterValidator.validateOrThrow(module.parameters, resolvedParams);

  return resolved;
}

function resolveModuleRefsInParams(
  rawParams: Record<string, string>,
  allOutputs: Record<string, Record<string, string>>,
  currentAlias: string,
): Record<string, string> {
  const hasModuleRef = Object.values(rawParams).some((v) => v.includes('${module.'));
  if (!hasModuleRef) return rawParams;

  const moduleSource = buildModuleSource(allOutputs);
  const resolver = new VariableResolver({ module: moduleSource }, new Set());
  const resolved: Record<string, string> = {};

  for (const [key, value] of Object.entries(rawParams)) {
    if (value.includes('${module.')) {
      let match: RegExpExecArray | null;
      const regex = new RegExp(VAR_REF.source, 'g');
      while ((match = regex.exec(value)) !== null) {
        const guardKey = match[1]!;
        if (!guardKey.startsWith('module.')) continue;
        const rest = guardKey.substring('module.'.length);
        const dot = rest.indexOf('.');
        if (dot < 0) continue;
        const refAlias = rest.substring(0, dot);
        if (!allOutputs[refAlias]) {
          throw new Error(
            `Forward reference to '${refAlias}' in import '${currentAlias}' — should have been caught by validateModuleRefs.`,
          );
        }
      }
      resolved[key] = resolver.resolveString(value, `${currentAlias}.${key}`);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

function validateOutputTemplateScope(
  template: string, outputName: string, moduleName: string,
  declaredParams: Set<string>,
): void {
  let match: RegExpExecArray | null;
  const regex = new RegExp(VAR_REF.source, 'g');
  while ((match = regex.exec(template)) !== null) {
    const key = match[1]!;
    const dot = key.indexOf('.');
    const prefix = dot >= 0 ? key.substring(0, dot) : key;
    if (prefix !== 'var') {
      throw new Error(
        `Output '${outputName}' in module '${moduleName}': template references '\${${key}}' — output templates may only use \${var.*} references.`,
      );
    }
    if (dot >= 0) {
      const paramName = key.substring(dot + 1);
      if (!declaredParams.has(paramName)) {
        throw new Error(
          `Output '${outputName}' in module '${moduleName}': references undeclared parameter '\${${key}}'. Declared parameters: ${[...declaredParams].join(', ')}`,
        );
      }
    }
  }
}

function resolveOutputs(
  module: YamlModule,
  paramScope: Record<string, string>,
): Record<string, string> {
  if (Object.keys(module.outputs).length === 0) return {};

  const outputResolver = new VariableResolver(
    { var: (name) => paramScope[name] }, new Set());

  const resolved: Record<string, string> = {};
  for (const [outputName, output] of Object.entries(module.outputs)) {
    validateOutputTemplateScope(
      output.value, outputName, module.name,
      new Set(Object.keys(module.parameters)));

    resolved[outputName] = outputResolver.resolveString(
      output.value, `output.${module.name}.${outputName}`);
  }
  return resolved;
}

export class ModuleExpander {
  static expand(
    imports: YamlImport[],
    availableModules: Record<string, YamlModule>,
    existingSections: Record<string, Record<string, unknown>>,
    deferredPrefixes?: Set<string>,
  ): ExpandedModule {
    validateImports(imports, availableModules);
    validateModuleRefs(imports, availableModules);

    const mergedSections: Record<string, Record<string, unknown>> = {};
    const moduleScopes: Record<string, Record<string, string>> = {};
    const importConditions: Record<string, string> = {};
    const allOutputs: Record<string, Record<string, string>> = {};

    for (const [key, value] of Object.entries(existingSections)) {
      mergedSections[key] = { ...value };
    }

    const deferred = deferredPrefixes ?? new Set<string>();

    for (const imp of imports) {
      const module = availableModules[imp.module]!;
      const resolvedParams = resolveModuleRefsInParams(
        imp.parameters, allOutputs, imp.as);
      const paramScope = resolveParameters(module, imp, resolvedParams);
      moduleScopes[imp.as] = paramScope;

      if (imp.when !== undefined) {
        importConditions[imp.as] = imp.when;
      }

      const resolvedOutputs = resolveOutputs(module, paramScope);
      allOutputs[imp.as] = resolvedOutputs;

      const sectionResolver = VariableResolver.forParams(
        module.parameters, paramScope, deferred);

      for (const [sectionName, sectionContent] of Object.entries(module.sections)) {
        if (!mergedSections[sectionName]) {
          mergedSections[sectionName] = {};
        }
        const targetSection = mergedSections[sectionName]!;

        for (const [contentKey, value] of Object.entries(sectionContent)) {
          const resolvedContentKey = contentKey.includes('${')
            ? sectionResolver.resolveString(contentKey, `${imp.as}.${sectionName}`)
            : contentKey;
          const prefixedKey = `${imp.as}.${resolvedContentKey}`;
          targetSection[prefixedKey] = sectionResolver.resolve(value);
        }
      }
    }

    return {
      sections: mergedSections,
      moduleScopes,
      importConditions,
      moduleOutputs: allOutputs,
    };
  }

  static outputSource(moduleOutputs: Record<string, Record<string, string>>): VariableSource {
    return buildModuleSource(moduleOutputs);
  }
}
