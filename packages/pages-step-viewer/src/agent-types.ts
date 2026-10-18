export type HealthStatus = 'healthy' | 'degraded' | 'unavailable';
export type GoalPriority = 'PRIMARY' | 'SECONDARY';
export type ConstraintSeverity = 'HARD' | 'SOFT';
export type GoalVisibility = 'PUBLIC' | 'PRIVATE';

export interface DispositionValue {
  term: string;
  weight: number;
}

export interface Disposition {
  mbtiType?: string;
  enneagramType?: string;
  socialOrient?: string | DispositionValue[];
  ruleFollowing?: string | DispositionValue[];
  riskAppetite?: string | DispositionValue[];
  autonomy?: string | DispositionValue[];
  conflictMode?: string | DispositionValue[];
  delegation?: boolean;
}

export interface Capability {
  name: string;
  description?: string;
  tags?: string[];
  qualityHint?: number;
  health?: HealthStatus;
}

export interface Goal {
  name?: string;
  description: string;
  priority: GoalPriority;
  visibility?: GoalVisibility;
}

export interface Constraint {
  name?: string;
  description: string;
  severity: ConstraintSeverity;
  visibility?: GoalVisibility;
}

export interface AgentDescriptor {
  name: string;
  description?: string;
  avatar?: string;
  slot?: string;
  slotVocabulary?: string;
  archetype?: string;
  provider?: string;
  modelFamily?: string;
  modelVersion?: string;
  dispositionVocabulary?: string;
  disposition?: Disposition;
  capabilities?: Capability[];
  goals?: Goal[];
  constraints?: Constraint[];
  briefing?: string;
}
