import { AssessmentEngine } from './AssessmentEngine';
import { LearningObjective, Question, StudentSession, AssessmentConfig, AssessmentResult } from './types';

export class AssessmentService {
  private sessions: Map<string, StudentSession> = new Map();
  private learningObjectives: LearningObjective[];
  private questions: Question[];
  private config: AssessmentConfig;

  constructor(
    learningObjectives: LearningObjective[],
    questions: Question[],
    config: AssessmentConfig
  ) {
    this.learningObjectives = learningObjectives;
    this.questions = questions;
    this.config = config;
  }

  public startSession(studentId: string): string {
    const sessionId = `${studentId}-${Date.now()}`;
    const session: StudentSession = {
      studentId,
      sessionId,
      loStats: {},
      totalQuestionsAsked: 0,
      lastUpdated: new Date()
    };

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  public getNextQuestion(sessionId: string): Question {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const engine = new AssessmentEngine(
      this.config,
      this.learningObjectives,
      this.questions,
      session
    );

    const nextLOId = engine.selectNextLO();
    return engine.selectQuestion(nextLOId);
  }

  public submitAnswer(sessionId: string, questionId: string, isCorrect: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const engine = new AssessmentEngine(
      this.config,
      this.learningObjectives,
      this.questions,
      session
    );

    engine.processAnswer(questionId, isCorrect);
    this.sessions.set(sessionId, session);
  }

  public getAssessmentResult(sessionId: string): AssessmentResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const engine = new AssessmentEngine(
      this.config,
      this.learningObjectives,
      this.questions,
      session
    );

    return engine.getAssessmentResult();
  }

  public shouldContinue(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const engine = new AssessmentEngine(
      this.config,
      this.learningObjectives,
      this.questions,
      session
    );

    return engine.shouldContinue();
  }

  public endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // Persistence methods would go here
  // For example:
  // public async saveSession(sessionId: string): Promise<void>
  // public async loadSession(sessionId: string): Promise<void>
} 