import { LearningObjective, Question, LOStats, StudentSession, AssessmentConfig, AssessmentResult } from './types';

export class AssessmentEngine {
  private config: AssessmentConfig;
  private learningObjectives: LearningObjective[];
  private questions: Question[];
  private session: StudentSession;

  constructor(
    config: AssessmentConfig,
    learningObjectives: LearningObjective[],
    questions: Question[],
    session: StudentSession
  ) {
    this.config = config;
    this.learningObjectives = learningObjectives;
    this.questions = questions;
    this.session = session;
  }

  private calculateLCB(loId: string): number {
    const stats = this.session.loStats[loId];
    if (!stats || stats.totalQuestions === 0) {
      return 0.5; // Default value for unexplored LOs
    }

    const failureRate = stats.incorrectAnswers / stats.totalQuestions;
    const explorationTerm = this.config.explorationParameter * 
      Math.sqrt(Math.log(this.session.totalQuestionsAsked) / stats.totalQuestions);
    
    return failureRate - explorationTerm;
  }

  public selectNextLO(): string {
    let minLCB = Infinity;
    let selectedLOId = '';

    for (const lo of this.learningObjectives) {
      const lcb = this.calculateLCB(lo.id);
      if (lcb < minLCB) {
        minLCB = lcb;
        selectedLOId = lo.id;
      }
    }

    return selectedLOId;
  }

  public selectQuestion(loId: string): Question {
    const availableQuestions = this.questions.filter(q => q.learningObjectiveId === loId);
    if (availableQuestions.length === 0) {
      throw new Error(`No questions available for LO ${loId}`);
    }

    // Simple random selection - could be enhanced with difficulty-based selection
    return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
  }

  public processAnswer(questionId: string, isCorrect: boolean): void {
    const question = this.questions.find(q => q.id === questionId);
    if (!question) {
      throw new Error(`Question ${questionId} not found`);
    }

    const loId = question.learningObjectiveId;
    if (!this.session.loStats[loId]) {
      this.session.loStats[loId] = {
        totalQuestions: 0,
        incorrectAnswers: 0,
        estimatedFailureRate: 0.5
      };
    }

    const stats = this.session.loStats[loId];
    stats.totalQuestions++;
    if (!isCorrect) {
      stats.incorrectAnswers++;
    }
    stats.estimatedFailureRate = stats.incorrectAnswers / stats.totalQuestions;
    
    this.session.totalQuestionsAsked++;
    this.session.lastUpdated = new Date();
  }

  public getAssessmentResult(): AssessmentResult {
    let maxFailureRate = -1;
    let weakestLO: LearningObjective | null = null;

    for (const lo of this.learningObjectives) {
      const stats = this.session.loStats[lo.id];
      if (stats && stats.estimatedFailureRate > maxFailureRate) {
        maxFailureRate = stats.estimatedFailureRate;
        weakestLO = lo;
      }
    }

    if (!weakestLO) {
      throw new Error('No assessment data available');
    }

    return {
      weakestLO,
      confidence: this.calculateConfidence(),
      totalQuestionsAsked: this.session.totalQuestionsAsked,
      recommendations: this.generateRecommendations()
    };
  }

  private calculateConfidence(): number {
    // Confidence increases with more questions asked
    const maxQuestions = this.config.maxQuestionsPerSession;
    return Math.min(1, this.session.totalQuestionsAsked / maxQuestions);
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Sort LOs by failure rate
    const sortedLOs = this.learningObjectives
      .map(lo => ({ 
        lo, 
        failureRate: this.session.loStats[lo.id]?.estimatedFailureRate || 0 
      }))
      .sort((a, b) => b.failureRate - a.failureRate);

    // Add recommendations for weakest LOs
    sortedLOs.slice(0, 3).forEach(({ lo }) => {
      recommendations.push(`Focus on ${lo.name}`);
    });

    return recommendations;
  }

  public shouldContinue(): boolean {
    return this.session.totalQuestionsAsked < this.config.maxQuestionsPerSession;
  }
} 