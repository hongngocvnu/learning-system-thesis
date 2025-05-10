interface Topic {
  id: number;
  name: string;
  description: string;
  lo_code: string;
  mastery_threshold: number;
  confidence_delta: number;
  min_samples: number;
  difficulty: number;
  concept_weight: number;
  time_decay_factor: number;
  questions: Question[];
  hasBeenAsked: boolean;
  alpha: number;
  beta: number;
  prerequisites: number[];
  level: number;
}

interface Question {
  id: number;
  question_rich_text: string;
  explanation: string;
  difficulty: number;
  concept_weight: number;
  time_decay_factor: number;
  choices: Choice[];
  correctOption: number;
}

interface Choice {
  id: number;
  question_id: number;
  choice: string;
  is_correct: boolean;
}

interface AssessmentConfig {
  maxQuestions: number;          // Maximum total questions per session
  minQuestionsPerTopic: number;  // Minimum questions needed per topic
  maxQuestionsPerTopic: number;  // Maximum questions per topic
  explorationFactor: number;     // C parameter for UCB algorithm
  minQuestionsForConfidence: number; // Minimum questions needed for confidence calculation
  masteryThreshold: number;  // Threshold for considering a topic mastered
  confidenceThreshold: number;  // Required confidence level
}

interface StudentState {
  topicEstimates: Map<number, number>;
  topicCounts: Map<number, number>;
  totalQuestions: number;
  answeredQuestions: Set<number>;
  questionHistory: Map<number, Set<number>>;
  sessionId: number;
  topicSuccesses: Map<number, number>;
  topicFailures: Map<number, number>;
  topicConfidence: Map<number, number>;
  topicMastery: Map<number, number>;
}

// Sampling Policies
interface SamplingPolicy {
  selectTopic(topics: Topic[], studentState: StudentState): number;
  getName(): string;
}

class HDoCPolicy implements SamplingPolicy {
  getName(): string {
    return 'HDoC';
  }

  selectTopic(topics: Topic[], studentState: StudentState): number {
    let selectedTopicId = -1;
    let minScore = Infinity;

    for (const topic of topics) {
      const Nt = studentState.topicCounts.get(topic.id) || 0;
      const alpha = studentState.topicSuccesses.get(topic.id) || 0;
      const beta = studentState.topicFailures.get(topic.id) || 0;
      const mastery = alpha / (alpha + beta);
      const confidence = this.calculateConfidence(alpha, beta);

      // HDoC score calculation
      const score = mastery - Math.sqrt(2 * Math.log(studentState.totalQuestions + 1) / Nt);

      console.log(`Topic ${topic.id} HDoC score:`, {
        mastery,
        confidence,
        questions: Nt,
        score
      });

      if (score < minScore) {
        minScore = score;
        selectedTopicId = topic.id;
      }
    }

    return selectedTopicId;
  }

  private calculateConfidence(alpha: number, beta: number): number {
    const total = alpha + beta;
    if (total === 0) return 0;
    const variance = (alpha * beta) / (Math.pow(total, 2) * (total + 1));
    return 1 - Math.sqrt(variance);
  }
}

class ThompsonSamplingPolicy implements SamplingPolicy {
  getName(): string {
    return 'Thompson Sampling';
  }

  selectTopic(topics: Topic[], studentState: StudentState): number {
    let selectedTopicId = -1;
    let minSample = Infinity;

    for (const topic of topics) {
      const alpha = studentState.topicSuccesses.get(topic.id) || 0;
      const beta = studentState.topicFailures.get(topic.id) || 0;
      const sample = this.sampleFromBeta(alpha + 1, beta + 1);

      console.log(`Topic ${topic.id} Thompson sample:`, {
        alpha,
        beta,
        sample
      });

      if (sample < minSample) {
        minSample = sample;
        selectedTopicId = topic.id;
      }
    }

    return selectedTopicId;
  }

  private sampleFromBeta(alpha: number, beta: number): number {
    const x = this.sampleFromGamma(alpha, 1);
    const y = this.sampleFromGamma(beta, 1);
    return x / (x + y);
  }

  private sampleFromGamma(shape: number, scale: number): number {
    if (shape < 1) {
      return this.sampleFromGamma(1 + shape, scale) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1/3;
    const c = 1 / Math.sqrt(9 * d);
    
    while (true) {
      const x = this.randomNormal();
      const v = Math.pow(1 + c * x, 3);
      
      if (x > -1 / c && Math.log(Math.random()) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return scale * d * v;
      }
    }
  }

  private randomNormal(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
}

class RandomPolicy implements SamplingPolicy {
  getName(): string {
    return 'Random';
  }

  selectTopic(topics: Topic[], studentState: StudentState): number {
    const availableTopics = topics.filter(topic => {
      const Nt = studentState.topicCounts.get(topic.id) || 0;
      return Nt < 10; // Maximum questions per topic
    });

    if (availableTopics.length === 0) return -1;

    const randomIndex = Math.floor(Math.random() * availableTopics.length);
    return availableTopics[randomIndex].id;
  }
}

// Stopping Criteria
interface StoppingCriteria {
  shouldStop(topics: Topic[], studentState: StudentState, config: AssessmentConfig): boolean;
  getName(): string;
}

class ConfidenceBasedStopping implements StoppingCriteria {
  getName(): string {
    return 'Confidence Based';
  }

  shouldStop(topics: Topic[], studentState: StudentState, config: AssessmentConfig): boolean {
    const weakTopics = topics.filter(topic => {
      const Nt = studentState.topicCounts.get(topic.id) || 0;
      const alpha = studentState.topicSuccesses.get(topic.id) || 0;
      const beta = studentState.topicFailures.get(topic.id) || 0;
      const mastery = alpha / (alpha + beta);
      const confidence = this.calculateConfidence(alpha, beta);

      console.log(`Topic ${topic.id} stopping check:`, {
        mastery,
        confidence,
        threshold: topic.mastery_threshold,
        minQuestions: config.minQuestionsPerTopic
      });

      return Nt >= config.minQuestionsPerTopic && 
             mastery < topic.mastery_threshold && 
             confidence >= config.confidenceThreshold;
    });

    return weakTopics.length > 0;
  }

  private calculateConfidence(alpha: number, beta: number): number {
    const total = alpha + beta;
    if (total === 0) return 0;
    const variance = (alpha * beta) / (Math.pow(total, 2) * (total + 1));
    return 1 - Math.sqrt(variance);
  }
}

class MinimumQuestionsStopping implements StoppingCriteria {
  getName(): string {
    return 'Minimum Questions';
  }

  shouldStop(topics: Topic[], studentState: StudentState, config: AssessmentConfig): boolean {
    const allTopicsHaveMinimumQuestions = topics.every(topic => {
      const Nt = studentState.topicCounts.get(topic.id) || 0;
      return Nt >= config.minQuestionsPerTopic;
    });

    return allTopicsHaveMinimumQuestions;
  }
}

class AdaptiveAssessmentSystem {
  private topics: Topic[];
  private config: AssessmentConfig;
  private randomSeed: number;
  private supabase: any;
  private _studentState: StudentState;
  private courseId: string;
  private questions: Question[];
  private samplingPolicy: SamplingPolicy;
  private stoppingCriteria: StoppingCriteria[];
  private userId: string;

  constructor(
    topics: Topic[],
    config: Partial<AssessmentConfig> = {},
    userId: string,
    supabase: any,
    courseId: string
  ) {
    this.topics = this.initializeTopics(topics);
    this.config = {
      maxQuestions: config.maxQuestions || 40,
      minQuestionsPerTopic: config.minQuestionsPerTopic || 3,
      maxQuestionsPerTopic: config.maxQuestionsPerTopic || 15,
      explorationFactor: config.explorationFactor || 0.5,
      minQuestionsForConfidence: config.minQuestionsForConfidence || 3,
      masteryThreshold: config.masteryThreshold || 0.8,
      confidenceThreshold: config.confidenceThreshold || 0.95
    };
    this.randomSeed = this.generateSessionSeed(userId);
    this._studentState = this.initializeStudentState();
    this.supabase = supabase;
    this.courseId = courseId;
    this.questions = [];
    this.userId = userId;

    // Initialize sampling policy
    this.samplingPolicy = new ThompsonSamplingPolicy(); // Default policy

    // Initialize stopping criteria
    this.stoppingCriteria = [
      new ConfidenceBasedStopping(),
      new MinimumQuestionsStopping()
    ];

    console.log('Assessment system initialized with config:', {
      maxQuestions: this.config.maxQuestions,
      minQuestionsPerTopic: this.config.minQuestionsPerTopic,
      maxQuestionsPerTopic: this.config.maxQuestionsPerTopic,
      minQuestionsForConfidence: this.config.minQuestionsForConfidence
    });
  }

  private initializeTopics(topics: Topic[]): Topic[] {
    return topics.map(topic => ({
      ...topic,
      hasBeenAsked: false,
      alpha: 1.0,  // Initial alpha for Thompson Sampling
      beta: 1.0,   // Initial beta for Thompson Sampling
      prerequisites: topic.prerequisites || [],
      level: topic.level || 0
    }));
  }

  private generateSessionSeed(userId: string): number {
    const timestamp = Date.now();
    const combined = `${userId}-${timestamp}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }

  private initializeStudentState(): StudentState {
    const topicEstimates = new Map<number, number>();
    const topicCounts = new Map<number, number>();
    const questionHistory = new Map<number, Set<number>>();
    const topicSuccesses = new Map<number, number>();
    const topicFailures = new Map<number, number>();
    const topicConfidence = new Map<number, number>();
    const topicMastery = new Map<number, number>();
    
    // Initialize all topics with default values
    this.topics.forEach(topic => {
      topicEstimates.set(topic.id, 0.5);
      topicCounts.set(topic.id, 0);
      questionHistory.set(topic.id, new Set<number>());
      topicSuccesses.set(topic.id, 0);
      topicFailures.set(topic.id, 0);
      topicConfidence.set(topic.id, 0);
      topicMastery.set(topic.id, 0);
    });

    return {
      topicEstimates,
      topicCounts,
      totalQuestions: 0,
      answeredQuestions: new Set<number>(),
      questionHistory,
      sessionId: Date.now(),
      topicSuccesses,
      topicFailures,
      topicConfidence,
      topicMastery
    };
  }

  private calculateLCB(topicId: number): number {
    const Nt = this._studentState.topicCounts.get(topicId) || 0;
    const µt = this._studentState.topicEstimates.get(topicId) || 0.5;
    
    // Only calculate LCB if we have enough questions
    if (Nt < this.config.minQuestionsForConfidence) {
      return Infinity; // Skip topics with insufficient data
    }
    
    return µt - this.config.explorationFactor * Math.sqrt(
      Math.log(this._studentState.totalQuestions + 1) / Nt
    );
  }

  private calculateThompsonSample(topicId: number): number {
    const topic = this.topics.find(t => t.id === topicId);
    if (!topic) return 0;

    // Sample from Beta distribution
    const x = this.random();
    const y = this.random();
    const beta = Math.sqrt(-2 * Math.log(x)) * Math.cos(2 * Math.PI * y);
    return (beta + 3) / 6; // Scale to [0,1]
  }

  private updateTopicConfidence(topicId: number): void {
    const Nt = this._studentState.topicCounts.get(topicId) || 0;
    const successes = this._studentState.topicSuccesses.get(topicId) || 0;
    
    if (Nt >= this.config.minQuestionsForConfidence) {
      const confidence = Nt / this.config.maxQuestions;
      this._studentState.topicConfidence.set(topicId, confidence);
    }
  }

  private updateTopicMastery(topicId: number): void {
    const topic = this.topics.find(t => t.id === topicId);
    if (!topic) return;

    const Nt = this._studentState.topicCounts.get(topicId) || 0;
    const successes = this._studentState.topicSuccesses.get(topicId) || 0;
    
    if (Nt >= this.config.minQuestionsForConfidence) {
      const mastery = successes / Nt;
      this._studentState.topicMastery.set(topicId, mastery);
    }
  }

  private selectNextTopic(): number {
    console.log(`Using ${this.samplingPolicy.getName()} policy to select next topic`);
    return this.samplingPolicy.selectTopic(this.topics, this._studentState);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private random(): number {
    // Simple pseudo-random number generator using the session seed
    this.randomSeed = (this.randomSeed * 16807) % 2147483647;
    return (this.randomSeed - 1) / 2147483646;
  }

  private selectQuestion(topicId: number): Question | null {
    const topic = this.topics.find(t => t.id === topicId);
    if (!topic) {
      console.log('Topic not found:', topicId)
      return null;
    }

    console.log(`Selecting question for topic ${topicId} from ${topic.questions.length} questions`)

    // Get questions not used in current session
    const unaskedQuestions = topic.questions.filter(
      q => !this._studentState.answeredQuestions.has(q.id)
    );

    console.log('Unasked questions:', unaskedQuestions.length)

    if (unaskedQuestions.length === 0) {
      console.log('No more unasked questions for topic:', topicId)
      return null;
    }

    return this.shuffleArray(unaskedQuestions)[0];
  }

  public processAnswer(questionId: number, isCorrect: boolean): void {
    const topic = this.topics.find(t => 
      t.questions.some(q => q.id === questionId)
    );
    if (!topic) return;

    // Update alpha (correct answers) and beta (incorrect answers)
    const currentAlpha = this._studentState.topicSuccesses.get(topic.id) || 0;
    const currentBeta = this._studentState.topicFailures.get(topic.id) || 0;
    
    this._studentState.topicSuccesses.set(topic.id, currentAlpha + (isCorrect ? 1 : 0));
    this._studentState.topicFailures.set(topic.id, currentBeta + (isCorrect ? 0 : 1));

    // Update question count for topic
    const Nt = this._studentState.topicCounts.get(topic.id) || 0;
    this._studentState.topicCounts.set(topic.id, Nt + 1);
    
    // Calculate new mastery level based on Beta-Bernoulli
    const newAlpha = this._studentState.topicSuccesses.get(topic.id) || 0;
    const newBeta = this._studentState.topicFailures.get(topic.id) || 0;
    const mastery = newAlpha / (newAlpha + newBeta);
    this._studentState.topicMastery.set(topic.id, mastery);

    // Update confidence
    const confidence = this.calculateConfidence(newAlpha, newBeta);
    this._studentState.topicConfidence.set(topic.id, confidence);

    // Update total questions and track answered questions
    this._studentState.totalQuestions += 1;
    this._studentState.answeredQuestions.add(questionId);
    this._studentState.questionHistory.get(topic.id)?.add(questionId);

    console.log(`Updated topic ${topic.id} mastery:`, {
      alpha: newAlpha,
      beta: newBeta,
      mastery,
      confidence,
      questionsAsked: Nt + 1,
      totalQuestions: this._studentState.totalQuestions
    });
  }

  public getNextQuestion(): Question | null {
    // Check if we've reached max questions
    if (this._studentState.totalQuestions >= this.config.maxQuestions) {
      console.log('Reached maximum number of questions');
      return null;
    }

    // Check if we have enough questions for each topic
    const topicsWithEnoughQuestions = this.topics.filter(topic => {
      const questionsAsked = this._studentState.topicCounts.get(topic.id) || 0;
      return questionsAsked >= topic.min_samples;
    });

    // If we don't have enough questions for any topic, use random selection
    if (topicsWithEnoughQuestions.length === 0) {
      console.log('Initialization phase: Using random selection');
      const availableTopics = this.topics.filter(topic => {
        const questionsAsked = this._studentState.topicCounts.get(topic.id) || 0;
        return questionsAsked < topic.min_samples;
      });
      
      if (availableTopics.length === 0) return null;
      
      const randomIndex = Math.floor(Math.random() * availableTopics.length);
      const selectedTopic = availableTopics[randomIndex];
      console.log(`Selected topic ${selectedTopic.id} for initialization`);
      return this.selectQuestion(selectedTopic.id);
    }

    // If we have enough questions for all topics, check confidence levels
    const topicsWithHighConfidence = this.topics.filter(topic => {
      const alpha = this._studentState.topicSuccesses.get(topic.id) || 0;
      const beta = this._studentState.topicFailures.get(topic.id) || 0;
      const confidence = this.calculateConfidence(alpha, beta);
      return confidence >= this.config.confidenceThreshold;
    });

    // If we have enough confident topics, focus on weakest ones
    if (topicsWithHighConfidence.length >= 3) {
      console.log('Exploitation phase: Focusing on weakest topics');
      const topicMasteries = this.topics.map(topic => {
        const alpha = this._studentState.topicSuccesses.get(topic.id) || 0;
        const beta = this._studentState.topicFailures.get(topic.id) || 0;
        const mastery = alpha / (alpha + beta);
        return { topicId: topic.id, mastery };
      });

      // Sort by mastery and select from bottom 3-5
      const sortedTopics = topicMasteries.sort((a, b) => a.mastery - b.mastery);
      const bottomTopics = sortedTopics.slice(0, Math.min(5, sortedTopics.length));
      
      // Log weakest topics
      console.log('Weakest topics:', bottomTopics.map(t => ({
        topicId: t.topicId,
        mastery: t.mastery,
        name: this.topics.find(topic => topic.id === t.topicId)?.name
      })));

      const randomBottomIndex = Math.floor(Math.random() * bottomTopics.length);
      const selectedTopicId = bottomTopics[randomBottomIndex].topicId;
      return this.selectQuestion(selectedTopicId);
    }

    // Otherwise, use Thompson Sampling or HDoC for exploration
    console.log('Exploration phase: Using sampling policy');
    const topicId = this.samplingPolicy.selectTopic(this.topics, this._studentState);
    if (topicId === -1) {
      console.log('No suitable topic found for exploration');
      return null;
    }

    const topic = this.topics.find(t => t.id === topicId);
    if (!topic) {
      console.log('Topic not found:', topicId);
      return null;
    }

    // Check if we need more questions for this topic
    const questionsAsked = this._studentState.topicCounts.get(topicId) || 0;
    if (questionsAsked >= topic.min_samples) {
      console.log(`Topic ${topicId} has enough questions (${questionsAsked}/${topic.min_samples})`);
      return null;
    }

    const question = this.selectQuestion(topicId);
    if (!question) {
      console.log('No more questions available for topic:', topicId);
      return null;
    }

    return question;
  }

  public getAssessmentResults(): {
    totalQuestions: number;
    recommendedTopics: Array<{
      id: number;
      name: string;
      lcb: number;
      ucb: number;
      questionsAsked: number;
      successRate: number;
      confidence: number;
      mastery: number;
      hasEnoughData: boolean;
      prerequisites: number[];
      level: number;
      failedQuestions: number;
    }>;
  } {
    console.log('Getting assessment results...');
    console.log('Total questions in state:', this._studentState.totalQuestions);
    console.log('Answered questions:', this._studentState.answeredQuestions.size);
    
    // Log all topics and their question counts
    this.topics.forEach(topic => {
      const Nt = this._studentState.topicCounts.get(topic.id) || 0;
      console.log(`Topic ${topic.name} (ID: ${topic.id}):`, {
        questionsAsked: Nt,
        questionHistory: Array.from(this._studentState.questionHistory.get(topic.id) || []),
        successes: this._studentState.topicSuccesses.get(topic.id) || 0,
        failures: this._studentState.topicFailures.get(topic.id) || 0
      });
    });

    const results = this.topics
      .filter(topic => {
        const Nt = this._studentState.topicCounts.get(topic.id) || 0;
        // Only include topics with at least 3 questions for reliable assessment
        const hasEnoughQuestions = Nt >= 3;
        if (hasEnoughQuestions) {
          console.log(`Including topic ${topic.name} with ${Nt} questions for assessment`);
        } else {
          console.log(`Skipping topic ${topic.name} with only ${Nt} questions - need at least 3 questions for reliable assessment`);
        }
        return hasEnoughQuestions;
      })
      .map(topic => {
      const Nt = this._studentState.topicCounts.get(topic.id) || 0;
      const successes = this._studentState.topicSuccesses.get(topic.id) || 0;
        const failures = this._studentState.topicFailures.get(topic.id) || 0;
      const confidence = this._studentState.topicConfidence.get(topic.id) || 0;
      const mastery = this._studentState.topicMastery.get(topic.id) || 0;
      const lcb = this.calculateLCB(topic.id);
        const ucb = mastery + confidence; // Upper Confidence Bound

        const result = {
        id: topic.id,
        name: topic.name,
        lcb,
          ucb,
        questionsAsked: Nt,
          successRate: Nt > 0 ? Math.min(100, Math.max(0, (successes / Nt) * 100)) : 0,
        confidence,
          mastery: Math.min(100, Math.max(0, mastery * 100)),
        hasEnoughData: Nt >= this.config.minQuestionsForConfidence,
        prerequisites: topic.prerequisites,
          level: topic.level,
          failedQuestions: failures
      };

        console.log(`Result for topic ${topic.name}:`, result);
        return result;
    });

    // If no topics have enough questions, return null
    if (results.length === 0) {
      console.log('No topics have enough questions for reliable assessment');
    return {
      totalQuestions: this._studentState.totalQuestions,
        recommendedTopics: []
      };
    }

    // Sort all results
    const sortedResults = results.sort((a, b) => {
      // First compare by UCB (lower is worse)
      if (a.ucb !== b.ucb) {
        return a.ucb - b.ucb;
      }
      // If UCBs are equal, compare by success rate (lower is worse)
      if (a.successRate !== b.successRate) {
        return a.successRate - b.successRate;
      }
      // If both UCB and success rate are equal, compare by number of questions (more questions = more reliable)
      return b.questionsAsked - a.questionsAsked;
    });

    // Only take the weakest LO
    const finalResults = {
      totalQuestions: this._studentState.totalQuestions,
      recommendedTopics: [sortedResults[0]]
    };

    // Log the weakest LO
    const weakestLO = finalResults.recommendedTopics[0];
    console.log('Weakest Learning Objective:', {
      name: weakestLO.name,
      ucb: weakestLO.ucb,
      successRate: weakestLO.successRate,
      questionsAsked: weakestLO.questionsAsked,
      failedQuestions: weakestLO.failedQuestions,
      confidence: weakestLO.confidence
    });

    console.log('Final assessment results:', {
      totalQuestions: finalResults.totalQuestions,
      weakestLO: {
        name: weakestLO.name,
        questionsAsked: weakestLO.questionsAsked,
        ucb: weakestLO.ucb,
        successRate: weakestLO.successRate,
        mastery: weakestLO.mastery,
        failedQuestions: weakestLO.failedQuestions,
        confidence: weakestLO.confidence
      }
    });

    return finalResults;
  }

  public getQuestionLimits(): {
    total: { current: number; max: number };
    perTopic: { min: number; max: number };
  } {
    return {
      total: {
        current: this._studentState.totalQuestions,
        max: this.config.maxQuestions
      },
      perTopic: {
        min: this.config.minQuestionsPerTopic,
        max: this.config.maxQuestionsPerTopic
      }
    };
  }

  public startNewSession(userId: string): void {
    this.randomSeed = this.generateSessionSeed(userId);
    this._studentState = this.initializeStudentState();
  }

  // Add getter for studentState
  public get studentState(): StudentState {
    return this._studentState;
  }

  // Add new method to fetch topics from database
  public static async initializeFromDatabase(
    courseId: string,
    userId: string,
    supabase: any,
    config: Partial<AssessmentConfig> = {}
  ): Promise<AdaptiveAssessmentSystem> {
    try {
      console.log('Initializing from database for course:', courseId)
      
      // Fetch chapters with detailed logging
      console.log('Fetching chapters...')
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', courseId)
        .order('order_num', { ascending: true });

      if (chaptersError) {
        console.error('Error fetching chapters:', chaptersError)
        throw chaptersError;
      }
      if (!chaptersData || chaptersData.length === 0) {
        console.error('No chapters found for course:', courseId)
        throw new Error('No chapters found for this course');
      }
      console.log('Chapters loaded:', chaptersData?.length, 'Chapter IDs:', chaptersData.map((c: any) => c.id))

      // Fetch learning objectives with detailed logging
      console.log('Fetching learning objectives...')
      const { data: losData, error: losError } = await supabase
        .from('learning_objectives')
        .select('*')
        .in('chapter_id', chaptersData.map((c: any) => c.id));

      if (losError) {
        console.error('Error fetching learning objectives:', losError)
        throw losError;
      }
      if (!losData || losData.length === 0) {
        console.error('No learning objectives found for chapters:', chaptersData.map((c: any) => c.id))
        throw new Error('No learning objectives found for this course');
      }
      console.log('Learning objectives loaded:', losData?.length, 'LO IDs:', losData.map((lo: any) => lo.id))

      // Fetch question-LO mappings with detailed logging
      console.log('Fetching question-LO mappings...')
      const { data: questionLosData, error: questionLosError } = await supabase
        .from('question_lo')
        .select('*')
        .in('lo_id', losData.map((lo: any) => lo.id));

      if (questionLosError) {
        console.error('Error fetching question-LO mappings:', questionLosError)
        throw questionLosError;
      }

      // Filter out LOs without questions
      const losWithQuestions = losData.filter((lo: any) => 
        questionLosData?.some((qlo: any) => qlo.lo_id === lo.id)
      );

      if (losWithQuestions.length === 0) {
        console.error('No learning objectives with questions found')
        throw new Error('No learning objectives have questions mapped to them');
      }

      console.log('Learning objectives with questions:', losWithQuestions.length)
      console.log('LOs without questions:', losData.length - losWithQuestions.length)

      // Fetch questions for LOs that have questions
      const questionIds = questionLosData
        ?.filter((qlo: any) => losWithQuestions.some((lo: any) => lo.id === qlo.lo_id))
        .map((qlo: any) => qlo.question_id) || [];

      console.log('Question IDs from mappings:', questionIds)

      // Fetch questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .in('id', questionIds);

      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
        throw new Error('Failed to fetch questions');
      }

      console.log('Questions found:', questionsData?.length || 0)
      console.log('Questions data:', questionsData)

      if (!questionsData || questionsData.length === 0) {
        console.error('No questions found for IDs:', questionIds)
        throw new Error('No questions found in the database');
      }

      // Fetch choices
      const { data: choicesData, error: choicesError } = await supabase
        .from('choices')
        .select('*')
        .in('question_id', questionsData.map((q: any) => q.id));

      if (choicesError) {
        console.error('Error fetching choices:', choicesError)
        throw new Error('Failed to fetch choices');
      }

      console.log('Choices found:', choicesData?.length || 0)
      console.log('Choices data:', choicesData)

      if (!choicesData || choicesData.length === 0) {
        console.error('No choices found for questions:', questionsData.map((q: any) => q.id))
        throw new Error('No choices found for questions');
      }

      // Transform data into topics, only for LOs with questions
      const topics: Topic[] = losWithQuestions.map((lo: any) => {
        const loQuestions = questionLosData
          ?.filter((qlo: any) => qlo.lo_id === lo.id)
          .map((qlo: any) => {
            const question = questionsData.find((q: any) => q.id === qlo.question_id);
            if (!question) {
              console.error('Question not found for ID:', qlo.question_id)
              return null;
            }

            const choices = choicesData.filter((c: any) => c.question_id === question.id);
            if (choices.length === 0) {
              console.error('No choices found for question:', question.id)
              return null;
            }

            const correctOption = choices.findIndex((c: any) => c.is_correct);
            if (correctOption === -1) {
              console.error('No correct option found for question:', question.id)
              return null;
            }

            return {
              ...question,
              choices,
              correctOption
            };
          })
          .filter(Boolean);

        console.log(`LO ${lo.id} has ${loQuestions.length} valid questions`)

        return {
          id: lo.id,
          name: lo.title,
          description: lo.description,
          lo_code: lo.lo_code,
          mastery_threshold: lo.mastery_threshold || 0.6,
          confidence_delta: lo.confidence_delta || 0.05,
          min_samples: lo.min_samples || 5,
          difficulty: lo.difficulty || 1.0,
          concept_weight: lo.concept_weight || 1.0,
          time_decay_factor: lo.time_decay_factor || 0.1,
          questions: loQuestions,
          hasBeenAsked: false,
          alpha: 1.0,
          beta: 1.0,
          prerequisites: [],
          level: 0
        };
      });

      console.log('Topics created:', topics.length)
      console.log('Topics with questions:', topics.filter(t => t.questions.length > 0).length)

      // Create and return the assessment system
      const assessment = new AdaptiveAssessmentSystem(topics, config, userId, supabase, courseId);
      console.log('Assessment system initialized successfully')
      return assessment;
    } catch (error) {
      console.error('Error initializing assessment system:', error)
      throw error;
    }
  }

  // Add method to save assessment results
  public async saveAssessmentResults(assessmentId: number): Promise<void> {
    try {
      console.log('Starting to save assessment results...');
      console.log('Student ID:', this.userId);
      console.log('Course ID:', this.courseId);

      // 1. Save to student_lo_mastery
      const masteryData = Array.from(this._studentState.topicMastery.entries()).map(([topicId, mastery]) => {
        const alpha = this._studentState.topicSuccesses.get(topicId) || 0;
        const beta = this._studentState.topicFailures.get(topicId) || 0;
        
        const data = {
          student_id: this.userId,
          lo_id: topicId,
          alpha: alpha,
          beta: beta,
          last_updated: new Date().toISOString(),
          performance_history: JSON.stringify([{
            mastery: Math.min(100, Math.max(0, mastery * 100)),
            questions_answered: this._studentState.topicCounts.get(topicId) || 0,
            timestamp: new Date().toISOString()
          }])
        };
        console.log(`Mastery data for topic ${topicId}:`, data);
        return data;
      });

      console.log('Saving mastery data...');
      const { error: masteryError } = await this.supabase
        .from('student_lo_mastery')
        .upsert(masteryData, { 
          onConflict: ['student_id', 'lo_id']
        });

      if (masteryError) {
        console.error('Error saving mastery data:', masteryError);
        throw masteryError;
      }
      console.log('Mastery data saved successfully');

      // 2. Save to assessment_sessions
      const sessionData = {
        student_id: this.userId,
        course_id: this.courseId,
        start_time: new Date(Date.now() - this._studentState.totalQuestions * 60000).toISOString(),
        end_time: new Date().toISOString(),
        status: 'completed',
        sampling_policy: 'Thompson',
        max_questions: this.config.maxQuestions,
        pre_sample_count: this.config.minQuestionsPerTopic
      };
      console.log('Saving session data:', sessionData);

      const { data: newSession, error: sessionError } = await this.supabase
        .from('assessment_sessions')
        .insert(sessionData)
        .select()
        .single();

      if (sessionError) {
        console.error('Error saving session data:', sessionError);
        throw sessionError;
      }
      console.log('Session data saved successfully:', newSession);

      // Use the generated session ID for assessment results
      const sessionId = newSession.id;
      console.log('Generated session ID:', sessionId);

      // 3. Save to assessment_results
      const resultsData = Array.from(this._studentState.answeredQuestions).map(questionId => {
        const topic = this.topics.find(t => 
          t.questions.some(q => q.id === questionId)
        );
        if (!topic) {
          console.warn(`Topic not found for question ${questionId}`);
          return null;
        }

        // Get the question history for this topic
        const questionHistory = this._studentState.questionHistory.get(topic.id) || new Set();
        const isCorrect = questionHistory.has(questionId) && 
                         (this._studentState.topicSuccesses.get(topic.id) || 0) > 0;

        const alpha = this._studentState.topicSuccesses.get(topic.id) || 0;
        const beta = this._studentState.topicFailures.get(topic.id) || 0;
        const confidence = this.calculateConfidence(alpha, beta);
        const mastery = Math.min(100, Math.max(0, (alpha / (alpha + beta)) * 100));

        const result = {
          assessment_id: sessionId,
          question_id: questionId,
          student_id: this.userId,
          is_correct: Boolean(isCorrect), // Ensure boolean value
          difficulty_level: topic.difficulty,
          pseudo_rewards: JSON.stringify({
            mastery: mastery / 100,
            confidence: confidence
          }),
          confidence_bounds: JSON.stringify({
            lower: Math.max(0, (alpha / (alpha + beta)) - confidence),
            upper: Math.min(1, (alpha / (alpha + beta)) + confidence)
          }),
          created_at: new Date().toISOString()
        };
        console.log(`Result data for question ${questionId}:`, result);
        return result;
      }).filter(Boolean);

      console.log('Saving results data...');
      const { error: resultsError } = await this.supabase
        .from('assessment_results')
        .insert(resultsData);

      if (resultsError) {
        console.error('Error saving results data:', resultsError);
        throw resultsError;
      }
      console.log('Results data saved successfully');

    } catch (error) {
      console.error('Error saving assessment results:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
      }
      throw error;
    }
  }

  private async fetchQuestionsAndChoices(questionIds: number[]): Promise<Question[]> {
    try {
      // Fetch questions
      const { data: questions, error: questionsError } = await this.supabase
        .from('questions')
        .select('*')
        .in('id', questionIds)

      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
        throw new Error('Failed to fetch questions')
      }

      if (!questions || questions.length === 0) {
        console.error('No questions found for IDs:', questionIds)
        throw new Error('No questions found in database')
      }

      // Fetch choices
      const { data: choices, error: choicesError } = await this.supabase
        .from('choices')
        .select('*')
        .in('question_id', questions.map((q: Question) => Number(q.id)))

      if (choicesError) {
        console.error('Error fetching choices:', choicesError)
        throw new Error('Failed to fetch choices')
      }

      if (!choices || choices.length === 0) {
        console.error('No choices found for questions:', questions.map((q: Question) => Number(q.id)))
        throw new Error('No choices found for questions')
      }

      // Map questions with their choices
      return questions.map((question: Question) => ({
        ...question,
        id: Number(question.id),
        choices: choices
          .filter((choice: Choice) => Number(choice.question_id) === Number(question.id))
          .map((choice: Choice) => ({
            ...choice,
            id: Number(choice.id),
            question_id: Number(choice.question_id)
          }))
      }))
    } catch (error) {
      console.error('Error in fetchQuestionsAndChoices:', error)
      throw error
    }
  }

  public setSamplingPolicy(policy: 'HDoC' | 'Thompson' | 'Random'): void {
    switch (policy) {
      case 'HDoC':
        this.samplingPolicy = new HDoCPolicy();
        break;
      case 'Thompson':
        this.samplingPolicy = new ThompsonSamplingPolicy();
        break;
      case 'Random':
        this.samplingPolicy = new RandomPolicy();
        break;
    }
  }

  private calculateConfidence(alpha: number, beta: number): number {
    // Calculate confidence based on Beta distribution variance
    const variance = (alpha * beta) / ((alpha + beta) ** 2 * (alpha + beta + 1));
    return 1 - Math.sqrt(variance); // Higher variance = lower confidence
  }

  // Add method to get learning path for weak topics
  public getLearningPathForWeakTopics(): {
    weakTopics: Array<{
      id: number;
      name: string;
      mastery: number;
      prerequisites: number[];
      level: number;
    }>;
    learningPath: Array<{
      id: number;
      name: string;
      level: number;
      isPrerequisite: boolean;
    }>;
  } {
    // Get topics with low mastery
    const topicMasteries = this.topics.map(topic => {
      const alpha = this._studentState.topicSuccesses.get(topic.id) || 0;
      const beta = this._studentState.topicFailures.get(topic.id) || 0;
      const mastery = alpha / (alpha + beta);
      return { id: topic.id, mastery };
    });

    const sortedTopics = topicMasteries.sort((a, b) => a.mastery - b.mastery);
    const weakTopics = sortedTopics
      .slice(0, Math.min(5, sortedTopics.length))
      .map(t => {
        const topic = this.topics.find(t => t.id === t.id);
        return {
          id: t.id,
          name: topic?.name || '',
          mastery: t.mastery,
          prerequisites: topic?.prerequisites || [],
          level: topic?.level || 0
        };
      });

    // Build learning path including prerequisites
    const learningPath = new Set<number>();
    weakTopics.forEach(topic => {
      // Add the weak topic
      learningPath.add(topic.id);
      // Add all prerequisites recursively
      const addPrerequisites = (topicId: number) => {
        const topic = this.topics.find(t => t.id === topicId);
        if (topic) {
          topic.prerequisites.forEach(prereqId => {
            learningPath.add(prereqId);
            addPrerequisites(prereqId);
          });
        }
      };
      addPrerequisites(topic.id);
    });

    // Convert to array and sort by level
    const sortedPath = Array.from(learningPath)
      .map(id => {
        const topic = this.topics.find(t => t.id === id);
        return {
          id,
          name: topic?.name || '',
          level: topic?.level || 0,
          isPrerequisite: weakTopics.every(wt => wt.id !== id)
        };
      })
      .sort((a, b) => a.level - b.level);

    return {
      weakTopics,
      learningPath: sortedPath
    };
  }
}

export { AdaptiveAssessmentSystem };
export type { Topic, Question, AssessmentConfig }; 