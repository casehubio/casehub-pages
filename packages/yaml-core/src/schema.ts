import { z } from 'zod';

const parameterTypeEnum = z.enum(['STRING', 'LIST', 'INTEGER', 'NUMBER', 'BOOLEAN']);

export const parameterSchema = z.object({
  type: parameterTypeEnum.default('STRING').optional(),
  required: z.boolean().default(false).optional(),
  defaultValue: z.string().optional(),
  minLength: z.number().int().optional(),
  maxLength: z.number().int().optional(),
  pattern: z.string().optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  allowedValues: z.array(z.string()).optional(),
  constraintDescription: z.string().optional(),
});

export const outputSchema = z.object({
  type: parameterTypeEnum,
  value: z.string(),
});

export const importSchema = z.object({
  module: z.string(),
  as: z.string(),
  when: z.string().optional(),
  parameters: z.record(z.string()).optional(),
});

export const forEachSchema = z.union([
  z.string(),
  z.object({
    as: z.string(),
    in: z.array(z.string()),
  }),
]);

export const iterationGroupSchema = z.object({
  as: z.string(),
  in: z.union([
    z.array(z.string()),
    z.string(),
  ]),
});

export const dataSourceSchema = z.object({
  inline: z.string().optional(),
});

export const moduleDefinitionSchema = z.object({
  parameters: z.record(parameterSchema).optional(),
  outputs: z.record(outputSchema).optional(),
  sections: z.record(z.record(z.unknown())).optional(),
  extends: z.string().optional(),
});

export const yamlCoreDocumentSchema = z.object({
  variables: z.record(z.record(z.string())).optional(),
  modules: z.record(moduleDefinitionSchema).optional(),
  imports: z.array(importSchema).optional(),
  iterations: z.record(iterationGroupSchema).optional(),
  data: z.record(dataSourceSchema).optional(),
});

export const yamlCoreElementMixin = {
  forEach: forEachSchema.optional(),
  when: z.string().optional(),
};
