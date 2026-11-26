export interface StepLineInfo {
  line: number;
  endLine: number;
  address: string;
}

function indent(line: string): number {
  let n = 0;
  while (n < line.length && line[n] === ' ') n++;
  return n;
}

function isListItem(line: string, minIndent: number): boolean {
  const ind = indent(line);
  if (ind < minIndent) return false;
  const stripped = line.substring(ind);
  return stripped.startsWith('- ') && stripped.length > 2;
}

function firstKey(line: string): string {
  const stripped = line.trimStart();
  const afterDash = stripped.startsWith('- ') ? stripped.substring(2) : stripped;
  const colon = afterDash.indexOf(':');
  return colon > 0 ? afterDash.substring(0, colon).trim() : '';
}

const CONTROL_FLOW = new Set(['if', 'try', 'match', 'parallel', 'race', 'select']);

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.substring(1, s.length - 1);
  }
  return s;
}

function selectBranchName(line: string, lines?: string[], start?: number, end?: number): string {
  const stripped = line.trimStart();
  const afterDash = stripped.startsWith('- ') ? stripped.substring(2) : stripped;
  const colon = afterDash.indexOf(':');
  if (colon <= 0) return '';
  const key = afterDash.substring(0, colon).trim();
  if (key !== 'subscribe' && key !== 'wait') return '';
  const raw = afterDash.substring(colon + 1).trim();
  if (raw) return unquote(raw);
  if (key === 'subscribe' && lines && start !== undefined && end !== undefined) {
    const childIndent = indent(line) + 4;
    for (let j = start + 1; j < end; j++) {
      const jLine = lines[j]!;
      if (jLine.trim() === '' || jLine.trim().startsWith('#')) continue;
      if (indent(jLine) !== childIndent) break;
      const jKey = firstKey(jLine);
      if (jKey === 'channel') {
        const jStripped = jLine.trimStart();
        const jColon = jStripped.indexOf(':');
        return jColon > 0 ? unquote(jStripped.substring(jColon + 1).trim()) : '';
      }
    }
  }
  return '';
}



function scanBlock(
  lines: string[],
  startLine: number,
  endLine: number,
  listIndent: number,
  prefix: string,
  results: StepLineInfo[],
): void {
  let stepIndex = 0;
  let i = startLine;

  while (i < endLine) {
    const line = lines[i]!;

    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }

    if (!isListItem(line, listIndent)) { i++; continue; }

    const lineIndent = indent(line);
    if (lineIndent !== listIndent) { i++; continue; }

    const address = prefix ? `${prefix}.${String(stepIndex)}` : String(stepIndex);
    const key = firstKey(line);
    const isControl = CONTROL_FLOW.has(key);

    const stepEndLine = findNextSibling(lines, i, listIndent, endLine);

    results.push({ line: i, endLine: stepEndLine, address });

    if (isControl) {
      scanControlFlow(lines, i, stepEndLine, listIndent, key, address, results);
    }

    stepIndex++;
    i = stepEndLine;
  }
}

function findNextSibling(lines: string[], start: number, listIndent: number, boundary: number): number {
  let i = start + 1;
  while (i < boundary) {
    const line = lines[i]!;
    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }
    const ind = indent(line);
    if (ind <= listIndent && isListItem(line, listIndent) && ind === listIndent) return i;
    if (ind < listIndent) return i;
    i++;
  }
  return boundary;
}

function scanControlFlow(
  lines: string[],
  stepStart: number,
  stepEnd: number,
  listIndent: number,
  key: string,
  address: string,
  results: StepLineInfo[],
): void {
  const contentIndent = listIndent + 2;

  if (key === 'if') {
    scanBranches(lines, stepStart, stepEnd, contentIndent, address, ['then', 'else'], results);
  } else if (key === 'try') {
    scanTryBody(lines, stepStart, stepEnd, contentIndent, listIndent, address, results);
  } else if (key === 'match') {
    scanMatchCases(lines, stepStart, stepEnd, contentIndent, address, results);
  } else if (key === 'parallel') {
    scanNamedBranches(lines, stepStart, stepEnd, contentIndent, address, 'lane', undefined, results);
  } else if (key === 'race') {
    scanNamedBranches(lines, stepStart, stepEnd, contentIndent, address, 'race', undefined, results);
  } else if (key === 'select') {
    scanNamedBranches(lines, stepStart, stepEnd, contentIndent, address, 'select', undefined, results);
  }
}

function scanBranches(
  lines: string[],
  stepStart: number,
  stepEnd: number,
  contentIndent: number,
  address: string,
  branchNames: string[],
  results: StepLineInfo[],
): void {
  for (const branchName of branchNames) {
    const branchLine = findBranchLine(lines, stepStart, stepEnd, contentIndent, branchName);
    if (branchLine < 0) continue;

    const branchContentIndent = contentIndent + 2;
    const branchEnd = findBranchEnd(lines, branchLine + 1, stepEnd, contentIndent);
    scanBlock(lines, branchLine + 1, branchEnd, branchContentIndent, `${address}.${branchName}`, results);
  }
}

function scanTryBody(
  lines: string[],
  stepStart: number,
  stepEnd: number,
  contentIndent: number,
  listIndent: number,
  address: string,
  results: StepLineInfo[],
): void {
  const tryLine = stepStart;
  const bodyIndent = contentIndent + 2;

  const bodyStart = tryLine + 1;
  let bodyEnd = stepEnd;

  const catchLine = findBranchLine(lines, stepStart, stepEnd, contentIndent, 'catch');
  const finallyLine = findBranchLine(lines, stepStart, stepEnd, contentIndent, 'finally');

  if (catchLine >= 0) bodyEnd = catchLine;
  else if (finallyLine >= 0) bodyEnd = finallyLine;

  scanBlock(lines, bodyStart, bodyEnd, bodyIndent, `${address}.body`, results);

  if (catchLine >= 0) {
    const catchEnd = finallyLine >= 0 ? finallyLine : stepEnd;
    scanBlock(lines, catchLine + 1, catchEnd, bodyIndent, `${address}.catch`, results);
  }

  if (finallyLine >= 0) {
    scanBlock(lines, finallyLine + 1, stepEnd, bodyIndent, `${address}.finally`, results);
  }
}

function scanMatchCases(
  lines: string[],
  stepStart: number,
  stepEnd: number,
  contentIndent: number,
  address: string,
  results: StepLineInfo[],
): void {
  const casesLine = findBranchLine(lines, stepStart, stepEnd, contentIndent, 'cases');
  if (casesLine < 0) return;

  const caseListIndent = contentIndent + 2;
  let caseIndex = 0;
  let i = casesLine + 1;
  while (i < stepEnd) {
    const line = lines[i]!;
    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }
    const ind = indent(line);
    if (ind < caseListIndent) break;
    if (!isListItem(line, caseListIndent) || ind !== caseListIndent) { i++; continue; }

    const caseEnd = findNextSibling(lines, i, caseListIndent, stepEnd);
    const caseContentIndent = caseListIndent + 2;
    const casePrefix = `${address}.match.${caseIndex}`;

    const caseKey = firstKey(line);
    if (caseKey === 'default') {
      scanBlock(lines, i + 1, caseEnd, caseContentIndent + 2, casePrefix, results);
    } else {
      for (let j = i + 1; j < caseEnd; j++) {
        const jLine = lines[j]!;
        if (jLine.trim() === '' || jLine.trim().startsWith('#')) continue;
        if (indent(jLine) !== caseContentIndent) continue;
        const jKey = firstKey(jLine);
        if (jKey === 'when' || jKey === 'pattern' || jKey === 'guard') continue;
        const stepEnd2 = caseEnd;
        const stepAddr = `${casePrefix}.0`;
        results.push({ line: j, endLine: stepEnd2, address: stepAddr });
        if (CONTROL_FLOW.has(jKey)) {
          scanControlFlow(lines, j, stepEnd2, caseListIndent, jKey, stepAddr, results);
        }
        break;
      }
    }

    caseIndex++;
    i = caseEnd;
  }
}

function scanNamedBranches(
  lines: string[],
  stepStart: number,
  stepEnd: number,
  contentIndent: number,
  address: string,
  label: string,
  containerKey: string | undefined,
  results: StepLineInfo[],
): void {
  let scanStart = stepStart + 1;

  if (containerKey) {
    const containerLine = findBranchLine(lines, stepStart, stepEnd, contentIndent, containerKey);
    if (containerLine < 0) return;
    scanStart = containerLine + 1;
  }

  const nameIndent = containerKey ? contentIndent + 2 : contentIndent + 2;
  const listItemIndent = nameIndent + 2;

  let laneIndex = 0;
  let i = scanStart;
  while (i < stepEnd) {
    const line = lines[i]!;
    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }

    const ind = indent(line);
    if (ind < nameIndent) break;
    if (ind !== nameIndent) { i++; continue; }

    const stripped = line.trimStart();
    if (stripped.startsWith('- ')) {
      if (label === 'lane') {
        const laneEnd = findNextSibling(lines, i, nameIndent, stepEnd);
        scanBlock(lines, i, laneEnd, nameIndent, `${address}.${label}.${laneIndex}`, results);
        laneIndex++;
        i = laneEnd;
        continue;
      }
      if (label === 'race') {
        scanBlock(lines, i, stepEnd, nameIndent, `${address}.race`, results);
        return;
      }
      if (label === 'select') {
        const childEnd = findNextSibling(lines, i, nameIndent, stepEnd);
        const name = selectBranchName(line, lines, i, childEnd);
        if (name) {
          const stepAddr = `${address}.select.${name}.0`;
          results.push({ line: i, endLine: childEnd, address: stepAddr });
          const contentInd = nameIndent + 2;
          for (let j = i + 1; j < childEnd; j++) {
            const jLine = lines[j]!;
            if (jLine.trim() === '' || jLine.trim().startsWith('#')) continue;
            if (indent(jLine) !== contentInd) continue;
            const jKey = firstKey(jLine);
            if (CONTROL_FLOW.has(jKey)) {
              scanControlFlow(lines, i, childEnd, nameIndent, jKey, stepAddr, results);
              break;
            }
          }
        }
        i = childEnd;
        continue;
      }
      i++; continue;
    }

    const colon = stripped.indexOf(':');
    if (colon <= 0) { i++; continue; }

    const name = stripped.substring(0, colon).trim();
    const branchEnd = findBranchEnd(lines, i + 1, stepEnd, nameIndent);

    scanBlock(lines, i + 1, branchEnd, listItemIndent, `${address}.${label}.${name}`, results);

    i = branchEnd;
  }
}

function findBranchLine(
  lines: string[],
  start: number,
  end: number,
  expectedIndent: number,
  branchName: string,
): number {
  for (let i = start; i < end; i++) {
    const line = lines[i]!;
    if (line.trim() === '') continue;
    const ind = indent(line);
    if (ind !== expectedIndent) continue;
    const stripped = line.trimStart();
    if (stripped.startsWith(`${branchName}:`)) return i;
  }
  return -1;
}

function findBranchEnd(lines: string[], start: number, boundary: number, branchIndent: number): number {
  let i = start;
  while (i < boundary) {
    const line = lines[i]!;
    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }
    const ind = indent(line);
    if (ind <= branchIndent) return i;
    i++;
  }
  return boundary;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Preserve the published static facade.
export class StepPositionScanner {
  static scan(rawYaml: string): StepLineInfo[] {
    const lines = rawYaml.split('\n');
    const totalLines = lines.length;

    let listIndent = -1;
    for (let i = 0; i < totalLines; i++) {
      const line = lines[i]!;
      if (line.trim() === '' || line.trim().startsWith('#')) continue;
      if (isListItem(line, 0)) {
        listIndent = indent(line);
        break;
      }
    }

    if (listIndent < 0) return [];

    const results: StepLineInfo[] = [];
    scanBlock(lines, 0, totalLines, listIndent, '', results);
    return results;
  }

  static findByLine(infos: readonly StepLineInfo[], line: number): StepLineInfo | undefined {
    let best: StepLineInfo | undefined;
    for (const info of infos) {
      if (line >= info.line && line < info.endLine) {
        if (!best || info.address.length > best.address.length) {
          best = info;
        }
      }
    }
    return best;
  }

  static findByAddress(infos: readonly StepLineInfo[], address: string): StepLineInfo | undefined {
    return infos.find(i => i.address === address);
  }
}
