export interface ActionIcon {
  symbol: string;
  colorClass: string;
}

const ICON_MAP: Record<string, ActionIcon> = {
  click:    { symbol: '⊡', colorClass: 'click' },
  fill:     { symbol: '✎', colorClass: 'fill' },
  select:   { symbol: '☰', colorClass: 'fill' },
  navigate: { symbol: '⤳', colorClass: 'nav' },
  assert:   { symbol: '✓', colorClass: 'assert' },
  log:      { symbol: '•', colorClass: 'log' },
  signal:   { symbol: '◇', colorClass: 'signal' },
  await:    { symbol: '◈', colorClass: 'await' },
  graphql:  { symbol: '◉', colorClass: 'graphql' },
  delay:    { symbol: '⏱', colorClass: 'delay' },
  'rest-request':       { symbol: '⇄', colorClass: 'rest' },
  'process':            { symbol: '⊞', colorClass: 'process' },
  'agent-invoke':       { symbol: '◈', colorClass: 'agent' },
  'mcp':                { symbol: '⊛', colorClass: 'mcp' },
  'emit-event':         { symbol: '◇', colorClass: 'event' },
  'verify-simulation':  { symbol: '✓', colorClass: 'assert' },
};

export function getActionIcon(actionName: string): ActionIcon {
  return ICON_MAP[actionName] ?? { symbol: '▸', colorClass: 'default' };
}
