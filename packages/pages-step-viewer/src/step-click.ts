import type {
  ResolvedStep, IfElseStep, TryCatchFinallyStep,
  MatchStep, ParallelStep, BlockStep, RaceStep, SelectStep,
} from '@casehubio/yaml-core/step';

export interface StepClickDetail {
  address: string;
  originalEvent: MouseEvent;
}

export function assignStepAddresses(
  steps: ResolvedStep[],
  prefix?: string,
): Map<ResolvedStep, string> {
  const map = new Map<ResolvedStep, string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const address = prefix !== undefined ? `${prefix}.${i}` : String(i);
    map.set(step, address);
    assignChildren(step, address, map);
  }

  return map;
}

function assignChildren(
  step: ResolvedStep,
  address: string,
  map: Map<ResolvedStep, string>,
): void {
  switch (step.kind) {
    case 'if-else': {
      const s = step as IfElseStep;
      assignInto(s.thenSteps, `${address}.then`, map);
      assignInto(s.elseSteps, `${address}.else`, map);
      break;
    }
    case 'try-catch-finally': {
      const s = step as TryCatchFinallyStep;
      assignInto(s.trySteps, `${address}.body`, map);
      assignInto(s.catchSteps, `${address}.catch`, map);
      assignInto(s.finallySteps, `${address}.finally`, map);
      break;
    }
    case 'match': {
      const s = step as MatchStep;
      for (let c = 0; c < s.cases.length; c++) {
        assignInto(s.cases[c]!.steps, `${address}.match.${c}`, map);
      }
      break;
    }
    case 'parallel': {
      const s = step as ParallelStep;
      if (s.branches && s.branches.length > 0) {
        for (const branch of s.branches) {
          assignInto(branch.steps, `${address}.lane.${branch.name}`, map);
        }
      } else {
        for (let b = 0; b < s.steps.length; b++) {
          const child = s.steps[b]!;
          const childAddr = `${address}.lane.${b}.0`;
          map.set(child, childAddr);
          assignChildren(child, childAddr, map);
        }
      }
      break;
    }
    case 'block': {
      const s = step as BlockStep;
      assignInto(s.steps, `${address}.block`, map);
      break;
    }
    case 'race': {
      const s = step as RaceStep;
      for (let r = 0; r < s.steps.length; r++) {
        const child = s.steps[r]!;
        const childAddr = `${address}.race.${r}`;
        map.set(child, childAddr);
        assignChildren(child, childAddr, map);
      }
      break;
    }
    case 'select': {
      const s = step as SelectStep;
      for (const branch of s.branches) {
        assignInto(branch.steps, `${address}.select.${branch.name}`, map);
      }
      break;
    }
  }
}

function assignInto(
  steps: ResolvedStep[],
  prefix: string,
  map: Map<ResolvedStep, string>,
): void {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!;
    const addr = `${prefix}.${i}`;
    map.set(step, addr);
    assignChildren(step, addr, map);
  }
}
