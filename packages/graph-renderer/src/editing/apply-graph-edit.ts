import type { GraphNode, GraphEdge, GraphModel } from '@casehubio/graph-core';
import { addNode, removeNode, addEdge, removeEdge, reconnectEdge, splitEdge, inboundEdges, outboundEdges } from '@casehubio/graph-core';
import type { EditResult } from '@casehubio/graph-core';
import type { GraphEdit } from './types.js';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${String(idCounter)}`;
}

export function applyGraphEdit(model: GraphModel, edit: GraphEdit): EditResult {
  switch (edit.type) {
    case 'addNode': {
      const node: GraphNode = {
        id: edit.id ?? nextId('node'),
        type: edit.nodeType,
        properties: edit.properties ?? {},
      };
      return addNode(model, node);
    }
    case 'removeNode': {
      if (edit.strategy.type === 'auto-join') {
        const inEdges = inboundEdges(model, edit.nodeId);
        const outEdges = outboundEdges(model, edit.nodeId);
        let result = removeNode(model, edit.nodeId);
        if (inEdges.length === 1 && outEdges.length === 1) {
          const joinEdge: GraphEdge = {
            id: nextId('edge'),
            type: inEdges[0]!.type,
            source: inEdges[0]!.source,
            target: outEdges[0]!.target,
          };
          result = addEdge(result.model, joinEdge);
        }
        return result;
      }
      return removeNode(model, edit.nodeId);
    }
    case 'addEdge': {
      const edge: GraphEdge = {
        id: nextId('edge'),
        type: edit.edgeType ?? 'default',
        source: edit.sourceId,
        target: edit.targetId,
      };
      return addEdge(model, edge);
    }
    case 'removeEdge':
      return removeEdge(model, edit.edgeId);
    case 'reconnectEdge':
      return reconnectEdge(model, edit.edgeId, edit.endpoints);
    case 'splitEdge': {
      const insertNode: GraphNode = {
        id: nextId('node'),
        type: edit.insertNodeType,
        properties: {},
      };
      return splitEdge(model, edit.edgeId, insertNode);
    }
    case 'moveNodeToEdge':
      throw new Error('moveNodeToEdge requires domain adapter — not executable at graph-core level');
    case 'compound': {
      let result: EditResult = { model, violations: [] };
      for (const subEdit of edit.edits) {
        result = applyGraphEdit(result.model, subEdit);
      }
      return result;
    }
  }
}
