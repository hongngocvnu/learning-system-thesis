export interface LearningObjective {
  id: string;
  name: string;
  description: string;
}

export interface Question {
  id: string;
  learningObjectiveId: string;
  content: string;
  options: string[];
  correctAnswer: number;
  difficulty?: number; // Optional difficulty rating (1-5)
}

export interface LOStats {
  totalQuestions: number;
  incorrectAnswers: number;
  estimatedFailureRate: number;
}

export interface StudentSession {
  studentId: string;
  sessionId: string;
  loStats: Record<string, LOStats>;
  totalQuestionsAsked: number;
  lastUpdated: Date;
}

export interface AssessmentConfig {
  explorationParameter: number; // C parameter for UCB
  maxQuestionsPerSession: number;
  minQuestionsPerLO: number;
}

export interface AssessmentResult {
  weakestLO: LearningObjective;
  confidence: number;
  totalQuestionsAsked: number;
  recommendations: string[];
} 