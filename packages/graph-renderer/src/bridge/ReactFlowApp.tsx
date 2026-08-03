import React, { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  SelectionMode,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type NodeTypes,
  type OnSelectionChangeFunc,
  type OnMoveEnd,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export interface ReactFlowAppProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onNodeClick?: (nodeId: string, node: Node) => void;
  onEdgeClick?: (edgeId: string, edge: Edge) => void;
  onSelectionChange?: (nodes: Node[], edges: Edge[]) => void;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
}

export function ReactFlowApp({
  nodes,
  edges,
  nodeTypes,
  onNodeClick,
  onEdgeClick,
  onSelectionChange,
  onViewportChange,
}: ReactFlowAppProps): React.JSX.Element {
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => { onNodeClick?.(node.id, node); },
    [onNodeClick],
  );

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => { onEdgeClick?.(edge.id, edge); },
    [onEdgeClick],
  );

  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      onSelectionChange?.(selectedNodes, selectedEdges);
    },
    [onSelectionChange],
  );

  const handleMoveEnd: OnMoveEnd = useCallback(
    (_event, viewport) => { onViewportChange?.(viewport); },
    [onViewportChange],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onSelectionChange={handleSelectionChange}
      onMoveEnd={handleMoveEnd}
      selectionOnDrag
      selectionMode={SelectionMode.Partial}
      fitView
    >
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
}
