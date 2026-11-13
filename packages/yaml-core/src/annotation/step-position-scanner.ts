export interface StepLineInfo {
  line: number;
  address: string;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Preserve the published static facade.
export class StepPositionScanner {
  static scan(rawYaml: string): StepLineInfo[] {
    const lines = rawYaml.split('\n');
    const positions: StepLineInfo[] = [];
    let stepIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const stripped = lines[i]!.trimStart();
      if (stripped.startsWith('- ') && stripped.length > 2) {
        positions.push({ line: i, address: String(stepIndex) });
        stepIndex++;
      }
    }
    return positions;
  }
}
