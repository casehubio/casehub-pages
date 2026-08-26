import type { GraphModel, GraphNode, GraphEdge } from './model.js';
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

export function addEdge(model: GraphModel, newEdge: GraphEdge): EditResult {
  if (model.edges.some(e => e.id === newEdge.id)) {
    throw new Error(`Duplicate edge ID '${newEdge.id}'`);
  }
  if (!model.nodes.some(n => n.id === newEdge.source)) {
    throw new Error(`Source node '${newEdge.source}' not found`);
  }
  if (!model.nodes.some(n => n.id === newEdge.target)) {
    throw new Error(`Target node '${newEdge.target}' not found`);
  }
  const newModel: GraphModel = {
    ...model,
    edges: [...model.edges, newEdge],
  };
  return { model: newModel, violations: validateConstraints(newModel) };
}

export function removeEdge(model: GraphModel, edgeId: string): EditResult {
  if (!model.edges.some(e => e.id === edgeId)) {
    throw new Error(`Edge '${edgeId}' not found`);
  }
  const newModel: GraphModel = {
    ...model,
    edges: model.edges.filter(e => e.id !== edgeId),
  };
  return { model: newModel, violations: validateConstraints(newModel) };
}
