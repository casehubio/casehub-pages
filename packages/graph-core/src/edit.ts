import type { GraphModel, GraphNode } from './model.js';
import type { ConstraintViolation } from './validator.js';
import { validateConstraints } from './validator.js';
import { subtreeOf } from './traversal.js';

export interface EditResult {
  readonly model: GraphModel;
  readonly violations: readonly ConstraintViolation[];
}

export function addNode(model: GraphModel, newNode: GraphNode): EditResult {
  if (model.nodes.some(n => n.id === newNode.id)) {
    throw new Error(`Duplicate node ID '${newNode.id}'`);
  }
  if (newNode.parentId !== undefined && !model.nodes.some(n => n.id === newNode.parentId)) {
    throw new Error(`Parent node '${newNode.parentId}' not found`);
  }
  const newModel: GraphModel = {
    ...model,
    nodes: [...model.nodes, newNode],
  };
  return { model: newModel, violations: validateConstraints(newModel) };
}

export function removeNode(model: GraphModel, nodeId: string): EditResult {
  if (!model.nodes.some(n => n.id === nodeId)) {
    throw new Error(`Node '${nodeId}' not found`);
  }
  const subtree = subtreeOf(model, nodeId);
  const removeIds = new Set(subtree.map(n => n.id));
  const newModel: GraphModel = {
    ...model,
    nodes: model.nodes.filter(n => !removeIds.has(n.id)),
    edges: model.edges.filter(e => !removeIds.has(e.source) && !removeIds.has(e.target)),
  };
  return { model: newModel, violations: validateConstraints(newModel) };
}

export function replaceNode(model: GraphModel, nodeId: string, newNode: GraphNode): EditResult {
  if (!model.nodes.some(n => n.id === nodeId)) {
    throw new Error(`Node '${nodeId}' not found`);
  }
  if (newNode.id !== nodeId) {
    throw new Error(`Replacement node ID '${newNode.id}' must match target '${nodeId}'`);
  }
  const newModel: GraphModel = {
    ...model,
    nodes: model.nodes.map(n => n.id === nodeId ? newNode : n),
  };
  return { model: newModel, violations: validateConstraints(newModel) };
}
