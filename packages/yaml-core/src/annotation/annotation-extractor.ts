import type { ParsedAnnotation } from './annotation-parser.js';
import type { StepLineInfo } from './step-position-scanner.js';
import { AnnotationMap } from './annotation-map.js';
import type { Annotation } from './annotation-map.js';

export class AnnotationExtractor {
  static extract(annotations: ParsedAnnotation[], stepPositions: StepLineInfo[]): AnnotationMap {
    const stepMap = new Map<string, Annotation[]>();
    const documentAnnotations: Annotation[] = [];

    for (const ann of annotations) {
      const annotation: Annotation = { name: ann.name, args: ann.args };
      const targetAddress = AnnotationExtractor.findTargetStep(ann.line, stepPositions);
      if (targetAddress === null) {
        documentAnnotations.push(annotation);
      } else {
        const existing = stepMap.get(targetAddress) ?? [];
        existing.push(annotation);
        stepMap.set(targetAddress, existing);
      }
    }

    return new AnnotationMap(stepMap, documentAnnotations);
  }

  private static findTargetStep(annotationLine: number, positions: StepLineInfo[]): string | null {
    if (positions.length === 0) return null;
    if (annotationLine < positions[0]!.line) return null;

    for (let i = 0; i < positions.length; i++) {
      const currentLine = positions[i]!.line;
      const nextLine = i + 1 < positions.length ? positions[i + 1]!.line : Infinity;

      if (annotationLine >= currentLine && annotationLine < nextLine) {
        if (i + 1 < positions.length) {
          return positions[i + 1]!.address;
        }
        return positions[i]!.address;
      }
    }
    return null;
  }
}
