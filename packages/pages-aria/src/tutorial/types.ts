export interface TutorialDescriptor {
  scenario: string;
  title: string;
  description: string;
  area: string;
  labels: string[];
  tags: string[];
  estimated?: string;
  prerequisites: string[];
  path: string;
  contentType: 'slides-only' | 'hands-on';
  hero?: { title: string; subtitle?: string; icon?: string };
}

export interface LearningPath {
  path: string;
  title: string;
  description: string;
  labels: string[];
  tutorials: string[];
}
