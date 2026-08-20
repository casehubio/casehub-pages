import React, { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  SelectionMode,
  ControlButton,
  type Node,
  type Edge,
  type EdgeTypes,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type NodeTypes,
  type OnSelectionChangeFunc,
  type OnMoveEnd,
  type ReactFlowInstance,
} from '@xyflow/react';
import { SmartBezierEdge, SmartEdgeProvider } from '@tisoap/react-flow-smart-edge';

const smartEdgeTypes: EdgeTypes = {
  default: SmartBezierEdge,
  smart: SmartBezierEdge,
};

export interface ReactFlowAppProps {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  onNodeClick?: (nodeId: string, node: Node) => void;
  onEdgeClick?: (edgeId: string, edge: Edge) => void;
  onSelectionChange?: (nodes: Node[], edges: Edge[]) => void;
  onViewportChange?: (viewport: { x: number; y: number; zoom: number }) => void;
  onRelayout?: () => void;
}

export function ReactFlowApp({
  nodes,
  edges,
  nodeTypes,
  onNodeClick,
  onEdgeClick,
  onSelectionChange,
  onViewportChange,
  onRelayout,
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
    <SmartEdgeProvider nodes={nodes}>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={smartEdgeTypes}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      onSelectionChange={handleSelectionChange}
      onMoveEnd={handleMoveEnd}
      selectionOnDrag
      selectionMode={SelectionMode.Partial}
      fitView
      fitViewOptions={{ padding: 0.05 }}
    >
      <MiniMap
        pannable
        zoomable
        nodeColor={(node) => {
          const t = node.type ?? '';
          if (t.includes('try-catch')) return '#c2410c';
          if (t.includes('switch')) return '#ca8a04';
          if (t.includes('raise')) return '#dc2626';
          if (t.includes('set')) return '#7c3aed';
          if (t.includes('start') || t.includes('entry')) return '#16a34a';
          if (t.includes('end') || t.includes('exit')) return '#64748b';
          return '#2563eb';
        }}
        style={{ background: 'var(--pages-neutral-3, #e5e5e5)' }}
        maskColor="rgba(0, 0, 0, 0.3)"
      />
      <Controls>
        {onRelayout && (
          <ControlButton onClick={onRelayout} title="Re-layout">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
          </ControlButton>
        )}
      </Controls>
      <Background />
    </ReactFlow>
    </SmartEdgeProvider>
  );
}
