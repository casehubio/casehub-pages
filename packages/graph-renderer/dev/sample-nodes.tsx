import React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export function SampleDefaultNode({ data }: NodeProps): React.JSX.Element {
  return (
    <div style={{
      padding: '10px 20px',
      borderRadius: 'var(--pages-radius-md, 8px)',
      background: 'var(--pages-neutral-2, #f0f0f0)',
      border: '1px solid var(--pages-neutral-6, #999)',
      fontFamily: 'var(--pages-font-family, system-ui)',
      fontSize: 'var(--pages-font-size-base, 14px)',
      color: 'var(--pages-text-primary, #111)',
    }}>
      <Handle type="target" position={Position.Top} />
      <div>{String(data?.['label'] ?? '')}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export function SampleGroupNode({ data }: NodeProps): React.JSX.Element {
  return (
    <div style={{
      padding: '30px 10px 10px',
      borderRadius: 'var(--pages-radius-lg, 12px)',
      background: 'var(--pages-accent-2, #e8f0ff)',
      border: '2px solid var(--pages-accent-7, #3366cc)',
      minWidth: '200px',
      minHeight: '150px',
      fontFamily: 'var(--pages-font-family, system-ui)',
      fontSize: 'var(--pages-font-size-sm, 12px)',
      color: 'var(--pages-accent-11, #003)',
    }}>
      <div style={{ position: 'absolute', top: 8, left: 12, fontWeight: 600 }}>
        {String(data?.['label'] ?? '')}
      </div>
    </div>
  );
}
