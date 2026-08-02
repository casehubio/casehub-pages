import React, { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
  type OnSelectionChangeFunc,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export interface ReactFlowAppProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onNodeClick?: (nodeId: string, node: Node) => void;
  onSelectionChange?: (nodes: Node[]) => void;
}

export function ReactFlowApp({
  nodes,
  edges,
  nodeTypes,
  onNodeClick,
  onSelectionChange,
}: ReactFlowAppProps): React.JSX.Element {
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => { onNodeClick?.(node.id, node); },
    [onNodeClick],
  );

  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => { onSelectionChange?.(selectedNodes); },
    [onSelectionChange],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onSelectionChange={handleSelectionChange}
      fitView
    >
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
}
