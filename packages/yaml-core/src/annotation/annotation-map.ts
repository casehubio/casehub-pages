export interface Annotation {
  name: string;
  args: Record<string, string>;
}

export class AnnotationMap {
  private readonly stepAnnotations: Map<string, Annotation[]>;
  private readonly documentAnnotations: Annotation[];

  constructor(stepAnnotations: Map<string, Annotation[]>, documentAnnotations: Annotation[]) {
    this.stepAnnotations = stepAnnotations;
    this.documentAnnotations = documentAnnotations;
  }

  forStep(address: string): Annotation[] {
    return this.stepAnnotations.get(address) ?? [];
  }

  forDocument(name: string): Annotation | undefined {
    return this.documentAnnotations.find(a => a.name === name);
  }

  hasStepAnnotation(address: string, name: string): boolean {
    return this.forStep(address).some(a => a.name === name);
  }

  allDocumentAnnotations(): Annotation[] {
    return [...this.documentAnnotations];
  }

  static empty(): AnnotationMap {
    return new AnnotationMap(new Map(), []);
  }
}
