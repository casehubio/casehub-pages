import React, { useRef, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { render, nothing, type TemplateResult, type SVGTemplateResult } from 'lit-html';
import type { GraphNode } from '@casehubio/graph-core';
import { getGrammar } from '@casehubio/graph-core';

export type StencilTemplate = TemplateResult | SVGTemplateResult;

export type StencilRenderFn = (node: GraphNode) => StencilTemplate;

interface ErrorBoundaryProps {
  nodeType: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class StencilErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`Stencil render error [${this.props.nodeType}]:`, error, info);
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div style={{
          padding: '8px 12px',
          background: '#fee',
          border: '1px solid #c00',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#900',
        }}>
          <strong>{this.props.nodeType}</strong>: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

export function createStencilNodeComponent(
  renderFn: StencilRenderFn,
): React.ComponentType<NodeProps> {
  function StencilNode({ id, type, data, parentId }: NodeProps): React.JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null);
    const grammar = type ? getGrammar(type) : undefined;

    useEffect(() => {
      if (!containerRef.current) return;
      const graphNode: GraphNode = {
        id,
        type: type ?? '',
        ...(parentId ? { parentId } : {}),
        properties: (data ?? {}) as Readonly<Record<string, unknown>>,
      };
      render(renderFn(graphNode), containerRef.current);
    }, [id, type, data, parentId]);

    useEffect(() => {
      return () => {
        if (containerRef.current) {
          render(nothing, containerRef.current);
        }
      };
    }, []);

    return (
      <>
        {grammar?.connections.inbound.max !== 0 && (
          <Handle type="target" position={Position.Top} />
        )}
        <div ref={containerRef} />
        {grammar?.connections.outbound.max !== 0 && (
          <Handle type="source" position={Position.Bottom} />
        )}
      </>
    );
  }

  function StencilNodeWithBoundary(props: NodeProps): React.JSX.Element {
    return (
      <StencilErrorBoundary nodeType={props.type ?? 'unknown'}>
        <StencilNode {...props} />
      </StencilErrorBoundary>
    );
  }

  return StencilNodeWithBoundary;
}
