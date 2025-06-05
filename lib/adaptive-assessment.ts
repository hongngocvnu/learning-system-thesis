import { SupabaseClient } from '@supabase/supabase-js';
import jstatPkg from 'jstat';
const { jStat } = jstatPkg;

// --- Interfaces (unchanged from previous refactoring, for clarity) ---
interface Topic {
  id: number;
  name: string;
  description: string;
  lo_code: string;
  mastery_threshold: number; // ξ in paper [cite: 19]
  confidence_delta: number; // δ in paper (often used as error rate) [cite: 19]
  min_samples: number; // Minimum samples required for a topic to be considered in adaptive phase
  difficulty: number;
  concept_weight: number;
  time_decay_factor: number;
  questions: Question[];
  hasBeenAsked: boolean; // Indicates if this topic has been presented in the current session
  alpha: number; // Beta distribution parameter
  beta: number; // Beta distribution parameter
  prerequisites: number[]; // Direct prerequisites (IDs of other Topics)
  level: number; // Used for learning path ordering
  questionsAsked: number;
  successRate: number;
  mastery: number;
  confidence: number;
  lcb: number;
  ucb: number;
  failedQuestions: number;
}

interface WeakKC {
  topicId: number;
  name: string;
  mastery: number; // 0-1
  confidence: number; // 0-1
  questionsAsked: number; // Questions asked for this topic in the current session
  alpha: number; // Beta alpha parameter
  beta: number;
  successRate: number; // 0-1
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
  topic_id: number;
  hasBeenAsked: boolean;
}

interface Choice {
  id: number;
  question_id: number;
  choice: string;
  is_correct: boolean;
}

interface AssessmentConfig {
  masteryThreshold: number; // ξ: Threshold for considering a topic mastered/strong [cite: 589]
  confidenceThreshold: number; // δ: Error rate for statistical confidence [cite: 588]
  preSampleCount: number; // π: Number of initial questions to ask for each LO in the pre-sample phase [cite: 638]
  maxQuestions: number; // Budget: Maximum total questions per session [cite: 431]
  sampling_policy: 'Thompson' | 'HDoC' | 'Random'; // MAB algorithm to use [cite: 604]
}

interface MasteryRecord {
  id: number;
  student_id: number;
  lo_id: number;
  chapter_id: number;
  course_id: number;
  alpha: number;
  beta: number;
  last_updated: string;
  performance_history?: string; // Optional: JSON string of past performance
}

interface TopicMasteryState {
  alpha: number;
  beta: number;
  mastery: number; // Empirical mean: alpha / (alpha + beta)
  confidence: number; // Metric where lower is better confidence (e.g., 1 / (alpha+beta+1))
  questionsAsked: number; // Questions asked for this topic in the CURRENT session
  historicalQuestionsAsked: number; // Total questions ever asked for this LO across all sessions
  lastUpdated: Date;
  performanceHistory: {
    mastery: number;
    questions_answered: number;
    timestamp: Date;
    alpha: number;
    beta: number;
  }[] | null; // Match the type with StudentLOMastery
}

interface Chapter {
  id: number;
  name: string;
  order_num: number;
  course_id: number;
  learning_objectives: Topic[];
}

interface AssessmentSession {
  id: number;
  student_id: number;
  course_id: number;
  chapter_id: number;
  start_time: Date;
  end_time: Date | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  sampling_policy: 'Thompson' | 'HDoC' | 'Random';
  max_questions: number;
  pre_sample_count: number;
  pre_sample_completed: boolean;
  pre_sample_progress: {
    lo_id: number;
    questions_asked: number;
  }[];
  questions_asked: number;
}

interface AssessmentResult {
  id: number;
  assessment_id: number;
  question_id: number;
  student_id: number;
  is_correct: boolean;
  difficulty_level: number;
  pseudo_rewards: {
    topicId: number;
    reward: number;
    graph: 'AND' | 'OR';
  }[];
  confidence_bounds: {
    lower: number;
    upper: number;
    mean: number;
  };
  created_at: Date;
  totalQuestions?: number; // Optional field for backward compatibility
}

interface AssessmentEndResult {
  sessionId: number;
  questionsAsked: number;
  weakKC: WeakKC | null;
  masteryStates: Map<number, TopicMasteryState>;
}

interface StudentLOMastery {
  id: number;
  student_id: number;
  lo_id: number;
  chapter_id: number;
  course_id: number;
  alpha: number;
  beta: number;
  last_updated: Date;
  performance_history: {
    mastery: number;
    questions_answered: number;
    timestamp: Date;
    alpha: number;
    beta: number;
  }[];
}

interface StudentState {
  totalQuestions: number; // total questions asked IN THIS SESSION
  answeredQuestions: Set<number>; // question IDs answered IN THIS SESSION (used for unique questions per session)
  sessionId: number; // Unique ID for the current assessment session
  topicMastery: Map<number, TopicMasteryState>; // Stores Beta parameters and other stats for each LO
  topicCounts: Map<number, number>; // Stores question counts per topic for current session
}

class StudentStateImpl implements StudentState {
  totalQuestions: number;
  answeredQuestions: Set<number>;
  sessionId: number;
  topicMastery: Map<number, TopicMasteryState>;
  topicCounts: Map<number, number>;

  constructor() {
    this.totalQuestions = 0;
    this.answeredQuestions = new Set<number>();
    this.sessionId = Date.now();
    this.topicMastery = new Map<number, TopicMasteryState>();
    this.topicCounts = new Map<number, number>();
  }
}

// --- SamplingPolicy Interface ---
interface SamplingPolicy {
  selectTopic(topics: Topic[], studentState: StudentState): number; // Returns Topic ID or -1 if none
  getName(): string;
  // updateAfterAnswer now calculates strong/weak status based on its own criteria for the given topic
  updateAfterAnswer(topicId: number, alpha: number, beta: number, masteryThreshold: number, delta: number, K: number, totalQuestions: number): 'remove' | 'weak' | null;
  reset(topics: Topic[]): void; // Resets internal state (e.g., 'A' set)
  initialize(topics: Topic[]): void; // Initializes internal state with all topics
  A: Set<number>; // Public property for the set of available arms [cite: 19]
}

// --- Helper Functions ---
function empiricalMean(alpha: number, beta: number): number {
  return (alpha + beta) > 0 ? alpha / (alpha + beta) : 0;
}

function betaCDF(x: number, alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) {
    return x; // A simple placeholder for uniform distribution (Beta(1,1)) or undefined behavior
  }
  try {
    return jStat.beta.cdf(x, alpha, beta);
  } catch (e) {
    console.error(`Error in betaCDF for x=${x}, alpha=${alpha}, beta=${beta}:`, e);
    return x; // Fallback
  }
}

// --- HDoC Policy ---
export class HDoCPolicy implements SamplingPolicy {
  public A: Set<number> = new Set();
  private initialized = false;
  private adaptiveRoundCount: number = 0; // Track adaptive phase rounds

  constructor() {}
  getName(): string { return 'HDoC'; }
  
  initialize(topics: Topic[]): void { 
    this.A = new Set(topics.map(t => t.id)); 
    this.initialized = true;
    this.adaptiveRoundCount = 0;
    console.log('HDoC policy initialized with topics:', {
      totalTopics: topics.length,
      availableTopics: this.A.size,
      topicIds: Array.from(this.A)
    });
  }

  reset(topics: Topic[]): void { 
    this.initialized = false; 
    this.initialize(topics);
    console.log('HDoC policy reset with topics:', {
      totalTopics: topics.length,
      availableTopics: this.A.size,
      topicIds: Array.from(this.A)
    });
  }

  selectTopic(topics: Topic[], studentState: StudentState): number {
    if (!this.initialized) this.initialize(topics);
    const availableTopics = topics.filter(t => this.A.has(t.id));
    console.log('HDoC selectTopic:', {
      initialized: this.initialized,
      totalTopics: topics.length,
      availableTopics: availableTopics.length,
      A: Array.from(this.A),
      topics: topics.map(t => ({ id: t.id, name: t.name })),
      adaptiveRoundCount: this.adaptiveRoundCount
    });
    
    if (availableTopics.length === 0) {
      console.log('No available topics in HDoC policy');
      return -1;
    }

    // Lấy tổng số câu hỏi đã hỏi trong session làm giá trị t (theo simulation.py)
    const t = Math.max(1, studentState.totalQuestions); 
    
    const scores: { [key: number]: number } = {};
    
    for (const topic of availableTopics) {
      const state = studentState.topicMastery.get(topic.id);
      if (!state) {
        console.log(`No state found for topic ${topic.id}`);
        continue;
      }
      
      const alpha = state.alpha;
      const beta = state.beta;
      
      // Calculate number of questions asked for this topic (N_i_t)
      let N_i_t = alpha + beta - 2; // Subtract initial Beta(1,1)
      
      // Handle cases with very few samples
      if (N_i_t <= 0) { // Use <= 0 for consistency with simulation.py and avoid log(<=0) or division by zero
        N_i_t = 1e-6; // Use a small value similar to simulation.py to avoid division by zero
      }
      
      // Calculate empirical mean (exploitation term)
      const mu_hat = alpha / (alpha + beta);
      
      // Calculate exploration term using the formula from simulation.py
      // Formula: sqrt(log(t) / (2 * N_i_t))
      let exploration_term = 0;
      if (t > 0 && N_i_t > 0) { // Ensure t and N_i_t are positive for log and sqrt
           exploration_term = Math.sqrt(Math.log(t) / (2 * N_i_t));
      }

      // Combine exploitation and exploration
      const score = mu_hat + exploration_term;
      scores[topic.id] = score;
      
      console.log(`Topic ${topic.id} score calculation:`, {
        alpha,
        beta,
        N_i_t,
        mu_hat,
        exploration_term,
        score,
        t,
        adaptiveRoundCount: this.adaptiveRoundCount
      });
    }

    // Tìm topic có score THẤP NHẤT (theo simulation.py)
    const selectedTopicId = Object.entries(scores)
      .reduce((min, [id, score]) => score < min[1] ? [Number(id), score] : min, [-1, Infinity])[0];
    
    console.log('HDoC selected topic:', {
      selectedTopicId,
      scores,
      adaptiveRoundCount: this.adaptiveRoundCount
    });
    
    return selectedTopicId;
  }

  updateAfterAnswer(topicId: number, alpha: number, beta: number, masteryThreshold: number, delta: number, K: number, totalQuestions: number): 'remove' | 'weak' | null {
    const N_i_t = alpha + beta - 2;  // Total samples for this topic (consistent with simulation.py)
    
    // Add logging for N_i_t
    console.log(`HDoC updateAfterAnswer for topic ${topicId} - N_i_t calculation: alpha=${alpha}, beta=${beta}, N_i_t=${N_i_t}`);

    if (N_i_t <= 0) {
      console.log(`HDoC updateAfterAnswer for topic ${topicId}: Not enough samples (N_i_t <= 0). Returning null.`);
      return null;
    }

    const mu_hat = alpha / (alpha + beta);
    
    // Sử dụng N_i_t làm giá trị t cho logarit (theo simulation.py)
    let t = N_i_t;
    if (t <= 0) { t = 1e-6; } // Handle case t <= 0 similarly to simulation.py

    // Calculate confidence radius using the formula from simulation.py
    // Formula: sqrt(log(t) / (2 * N_i_t))
    let confidence_radius = 0;
     if (t > 0 && N_i_t > 0) { // Ensure t and N_i_t are positive for log and sqrt
        confidence_radius = Math.sqrt(Math.log(t) / (2 * N_i_t));
     }
    
    const mu_bar = mu_hat + confidence_radius; // mu_bar is UCB in this context (according to simulation.py logic)

    // Add detailed logging for calculations and comparisons
    console.log(`HDoC updateAfterAnswer for topic ${topicId} - Calculations:`, {
      mu_hat: mu_hat.toFixed(4),
      confidence_radius: confidence_radius.toFixed(4),
      mu_bar: mu_bar.toFixed(4)
    });

    console.log(`HDoC updateAfterAnswer for topic ${topicId} - Comparisons:`, {
      mu_hat_vs_threshold: `${mu_hat.toFixed(4)} >= ${masteryThreshold.toFixed(4)} (${mu_hat >= masteryThreshold})`,
      mu_bar_vs_threshold: `${mu_bar.toFixed(4)} < ${masteryThreshold.toFixed(4)} (${mu_bar < masteryThreshold})`
    });

    // Change conditions for 'remove' and 'weak' to match simulation.py
    // remove: mu_hat >= masteryThreshold
    // weak: mu_bar < masteryThreshold (where mu_bar = mu_hat + confidence_radius)
    if (mu_hat >= masteryThreshold) {
      console.log(`HDoC updateAfterAnswer for topic ${topicId}: mu_hat >= threshold. Marking as 'remove'.`);
      this.A.delete(topicId);
      return 'remove';
    } else if (mu_bar < masteryThreshold) {
      console.log(`HDoC updateAfterAnswer for topic ${topicId}: mu_bar < threshold. Marking as 'weak'.`);
      return 'weak';
    }
    
    console.log(`HDoC updateAfterAnswer for topic ${topicId}: Neither weak nor strong conditions met. Returning null.`);
    return null;
  }
}

// --- Thompson Sampling Policy ---
export class ThompsonSamplingPolicy implements SamplingPolicy {
  public A: Set<number> = new Set();
  private initialized = false;

  constructor() {}
  getName(): string { return 'Thompson Sampling'; }
  initialize(topics: Topic[]): void { this.A = new Set(topics.map(t => t.id)); this.initialized = true; }

  selectTopic(topics: Topic[], studentState: StudentState): number {
    if (!this.initialized) this.initialize(topics);
    const availableTopics = topics.filter(t => this.A.has(t.id));
    if (availableTopics.length === 0) return -1;

    let selectedTopicId = -1;
    let minSample = Infinity;

    for (const topic of availableTopics) {
      const state = studentState.topicMastery.get(topic.id) || { alpha: 1, beta: 1 };  // Match simulation.py
      const alpha = Math.max(0.001, state.alpha);
      const beta = Math.max(0.001, state.beta);
      const sample = jStat.beta.sample(alpha, beta);
      
      if (sample < minSample) {
        minSample = sample;
        selectedTopicId = topic.id;
      }
    }
    return selectedTopicId;
  }

  updateAfterAnswer(topicId: number, alpha: number, beta: number, masteryThreshold: number, delta: number, K: number, totalQuestions: number): 'remove' | 'weak' | null {
    const cdfAlpha = Math.max(0.001, alpha);
    const cdfBeta = Math.max(0.001, beta);
    const prob = 1 - jStat.beta.cdf(masteryThreshold, cdfAlpha, cdfBeta);
    
    if (prob >= 1 - delta) {
      this.A.delete(topicId);
      return 'remove';
    } else if (prob < delta) {
      return 'weak';
    }
    return null;
  }

  reset(topics: Topic[]): void { this.initialized = false; this.initialize(topics); }
}

// --- Random Policy ---
export class RandomPolicy implements SamplingPolicy {
  public A: Set<number> = new Set();
  private initialized = false;

  constructor() {}
  getName(): string { return 'Random'; }
  initialize(topics: Topic[]): void { this.A = new Set(topics.map(t => t.id)); this.initialized = true; }

  selectTopic(topics: Topic[], studentState: StudentState): number {
    if (!this.initialized) this.initialize(topics);
    const available = topics.filter(t => this.A.has(t.id));
    if (available.length === 0) return -1;
    const idx = Math.floor(Math.random() * available.length);
    return available[idx].id;
  }

  updateAfterAnswer(topicId: number, alpha: number, beta: number, masteryThreshold: number, delta: number, K: number, totalQuestions: number): 'remove' | 'weak' | null {
    const mu = (alpha + beta) > 0 ? alpha / (alpha + beta) : 0;
    if (mu >= masteryThreshold) { this.A.delete(topicId); return 'remove'; }
    if (mu < masteryThreshold) return 'weak';
    return null;
  }

  reset(topics: Topic[]): void { this.initialized = false; this.initialize(topics); }
}


// --- RawQuestion Interface (unchanged) ---
interface RawQuestion {
  id: number;
  question_rich_text: string;
  explanation: string | null;
  difficulty: number;
  concept_weight: number;
  time_decay_factor: number;
  choices: Array<{
    id: number;
    question_id: number;
    choice: string;
    is_correct: boolean;
  }>;
  topic_id: number;
}

// --- AdaptiveAssessmentSystem Class ---
export class AdaptiveAssessmentSystem {
  private readonly courseId: number;
  private readonly chapterId: number;
  private readonly studentId: number;
  private readonly supabase: SupabaseClient;
  private readonly config: AssessmentConfig;
  private topics: Topic[] = [];
  private questions: Question[] = [];
  private questionToTopicMap: Map<number, number> = new Map();
  private isInitialized: boolean = false;
  private sessionId: number | null = null;
  private sessionStartTime: Date | null = null;
  private questionsAsked: number = 0;
  private currentPhase: 'pre_sample' | 'adaptive' = 'pre_sample';
  private preSampleCounts: Map<number, number> = new Map();
  private weakKC: WeakKC | null = null;
  private randomSeed: number;
  private samplingPolicy: HDoCPolicy;
  private _studentState: StudentStateImpl;
  private pseudoRewardFactor: number = 2;
  private currentSession: AssessmentSession | null = null;
  private preSampleProgress: Map<number, number> = new Map();

  private constructor(
    courseId: number,
    chapterId: number,
    studentId: number,
    supabase: SupabaseClient,
    config: AssessmentConfig
  ) {
    this.courseId = courseId;
    this.chapterId = chapterId;
    this.studentId = studentId;
    this.supabase = supabase;
    this.config = config;
    this.randomSeed = Math.random();
    this.samplingPolicy = new HDoCPolicy();
    this._studentState = new StudentStateImpl();
  }

  // --- Helper Functions ---
  private generateSessionSeed(userId: number): number {
    const timestamp = Date.now();
    const combined = `${userId}-${timestamp}`;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash) + combined.charCodeAt(i);
      hash = hash & hash;
    }
    return hash;
  }

  private calculateConfidenceMetric(alpha: number, beta: number): number {
    const total = alpha + beta;
    if (total <= 0) return 1; // Max uncertainty if no data or invalid
    return 1 / (total + 1); // A simple inverse relation with total samples, representing uncertainty
  }

  private initializeDefaultMasteryState(topicId: number): void {
    this._studentState.topicMastery.set(topicId, {
      alpha: 1,
      beta: 1,
      mastery: 0.5,
      confidence: this.calculateConfidenceMetric(1, 1),
      questionsAsked: 0,
      historicalQuestionsAsked: 0,
      lastUpdated: new Date(),
      performanceHistory: []
    });
    this._studentState.topicCounts.set(topicId, 0);
  }

  private random(): number {
    this.randomSeed = (this.randomSeed * 16807) % 2147483647;
    return (this.randomSeed - 1) / 2147483646;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // --- Core Logic Methods ---

  // NEW: Re-added private updateTopicMastery method
  private updateTopicMastery(topicId: number, isCorrect: boolean): void {
    const topic = this.topics.find(t => t.id === topicId);
    if (!topic) {
      console.error(`Topic ${topicId} not found`);
      return;
    }

    // Get current state, or initialize Beta(1,1) if first time seeing this topic [cite: 19]
    const currentState = this._studentState.topicMastery.get(topicId) || {
      alpha: 1,
      beta: 1,
      mastery: 0.5,
      confidence: this.calculateConfidenceMetric(1, 1),
      questionsAsked: 0, // questions asked in current session
      historicalQuestionsAsked: 0, // total questions ever asked for this LO
      lastUpdated: new Date(),
      performanceHistory: [] // Initialize as empty array
    };

    // Update counts
    const newAlpha = currentState.alpha + (isCorrect ? 1 : 0);
    const newBeta = currentState.beta + (isCorrect ? 0 : 1);
    const questionsAsked = currentState.questionsAsked + 1;
    const historicalQuestionsAsked = currentState.historicalQuestionsAsked + 1;

    // Calculate new mastery and confidence
    const newMastery = empiricalMean(newAlpha, newBeta);
    const newConfidenceMetric = this.calculateConfidenceMetric(newAlpha, newBeta);

    // Update mastery state
    const updatedState: TopicMasteryState = {
      alpha: newAlpha,
      beta: newBeta,
      mastery: newMastery,
      confidence: newConfidenceMetric, // Lower value means higher confidence
      questionsAsked,
      historicalQuestionsAsked,
      lastUpdated: new Date(),
      performanceHistory: currentState.performanceHistory // Keep existing history reference
    };

    this._studentState.topicMastery.set(topicId, updatedState);
    this._studentState.topicCounts.set(topicId, questionsAsked); // topicCounts is for current session

    console.log(`Updated topic ${topicId} mastery:`, {
      alpha: newAlpha.toFixed(2),
      beta: newBeta.toFixed(2),
      mastery: newMastery.toFixed(2),
      confidenceMetric: newConfidenceMetric.toFixed(2),
      questionsAskedSession: questionsAsked,
      questionsAskedHistorical: historicalQuestionsAsked,
      isCorrect,
      masteryPercentage: Math.round(newMastery * 100)
    });

    // Apply pseudo-rewards to dependent topics [cite: 19]
    this.applyPseudoRewards(topicId, isCorrect);
  }

  private async applyPseudoRewards(topicId: number, isCorrect: boolean): Promise<void> {
    try {
      // Fetch LOs that have 'topicId' as a prerequisite and are in the same chapter
      const dependentLOs = await this.fetchDependentLOs(topicId);

      // Filter to only include LOs from current chapter
      const chapterDependentLOs = dependentLOs.filter(lo => 
        this.topics.some(topic => topic.id === lo.id)
      );

      const c = 1; // pseudo-reward factor (reduced to avoid over-updating)
      for (const dependent of chapterDependentLOs) {
        const dependentTopicId = dependent.id; // dependent.id is already number
        const currentState = this._studentState.topicMastery.get(dependentTopicId);
        
        // Initialize if not already present
        if (!currentState) {
          this.initializeDefaultMasteryState(dependentTopicId);
        }

        const depState = this._studentState.topicMastery.get(dependentTopicId)!;

        // Update with pseudo-reward: alpha_i2 <- alpha_i2 + 1/c (if correct), beta_i2 <- beta_i2 + 1/c (if incorrect) [cite: 19]
        const newAlpha = depState.alpha + (isCorrect ? (1 / c) : 0);
        const newBeta = depState.beta + (!isCorrect ? (1 / c) : 0);
        const newMastery = empiricalMean(newAlpha, newBeta);
        const newConfidenceMetric = this.calculateConfidenceMetric(newAlpha, newBeta);

        const updatedState: TopicMasteryState = {
          ...depState,
          alpha: newAlpha,
          beta: newBeta,
          mastery: newMastery,
          confidence: newConfidenceMetric,
          lastUpdated: new Date(),
          performanceHistory: depState.performanceHistory // Keep existing history reference
        };

        this._studentState.topicMastery.set(dependentTopicId, updatedState);

        console.log(`Applied pseudo-reward to dependent topic ${dependentTopicId} (graph: ${dependent.graph}):`, {
          oldAlpha: depState.alpha.toFixed(2), newAlpha: newAlpha.toFixed(2),
          oldBeta: depState.beta.toFixed(2), newBeta: newBeta.toFixed(2),
          mastery: newMastery.toFixed(2)
        });
      }
    } catch (error) {
      console.error('Error applying pseudo-rewards:', error);
    }
  }

  // Fixed fetchDependentLOs to return number IDs and accept number ID
  private async fetchDependentLOs(prerequisiteLOId: number): Promise<Array<{ id: number, graph: string }>> {
    try {
      const { data: dependencies, error } = await this.supabase
        .from('lo_dependencies')
        .select('dependent_lo_id, graph') // Ensure 'graph' column is selected
        .eq('lo_id', prerequisiteLOId);

      if (error) {
        console.error('Error fetching LO dependencies:', error);
        return [];
      }

      return dependencies?.map((d: { dependent_lo_id: number, graph: string }) => ({
        id: d.dependent_lo_id,
        graph: d.graph
      })) || [];
    } catch (error) {
      console.error('Error in fetchDependentLOs:', error);
      return [];
    }
  }

  public async getAssessmentResults(): Promise<AssessmentResult> {
    if (this._studentState.totalQuestions === 0 && !this.weakKC) {
      return {
        id: 0,
        assessment_id: this.currentSession?.id || 0,
        question_id: 0,
        student_id: this.studentId,
        is_correct: false,
        difficulty_level: 0,
        pseudo_rewards: [],
        confidence_bounds: {
          lower: 0,
          upper: 0,
          mean: 0
        },
        created_at: new Date(),
        totalQuestions: 0
      };
    }

    const weakLO = this.weakKC;
    if (!weakLO) {
      console.log('No weak LO detected by sampling policy to recommend.');
      return {
        id: 0,
        assessment_id: this.currentSession?.id || 0,
        question_id: 0,
        student_id: this.studentId,
        is_correct: false,
        difficulty_level: 0,
        pseudo_rewards: [],
        confidence_bounds: {
          lower: 0,
          upper: 0,
          mean: 0
        },
        created_at: new Date(),
        totalQuestions: this._studentState.totalQuestions
      };
    }

    const state = this._studentState.topicMastery.get(weakLO.topicId);
    if (!state) {
      console.log('No state found for weak LO:', weakLO.topicId);
      return {
        id: 0,
        assessment_id: this.currentSession?.id || 0,
        question_id: 0,
        student_id: this.studentId,
        is_correct: false,
        difficulty_level: 0,
        pseudo_rewards: [],
        confidence_bounds: {
          lower: 0,
          upper: 0,
          mean: 0
        },
        created_at: new Date(),
        totalQuestions: this._studentState.totalQuestions
      };
    }

    const alpha = state.alpha;
    const beta = state.beta;
    const questionsAsked = state.questionsAsked;
    const mastery = empiricalMean(alpha, beta);
    const confidence = (1 - state.confidence); // Convert internal metric to intuitive confidence (higher is better)

    const delta = this.config.confidenceThreshold;
    const validAlpha = Math.max(0.001, alpha); // Ensure > 0 for jStat.beta.inv
    const validBeta = Math.max(0.001, beta);

    const lowerQuantile = jStat.beta.inv(delta / 2, validAlpha, validBeta);
    const upperQuantile = jStat.beta.inv(1 - delta / 2, validAlpha, validBeta);
    const lcb = Math.max(0, Math.min(1, lowerQuantile));
    const ucb = Math.max(0, Math.min(1, upperQuantile));

    const topicDetails = this.topics.find(t => t.id === weakLO.topicId);

    const weakLOResult = {
      id: weakLO.topicId,
      name: weakLO.name,
      lcb, ucb, questionsAsked,
      successRate: questionsAsked > 0 ? (alpha / questionsAsked) : 0,
      confidence, mastery,
      prerequisites: topicDetails?.prerequisites || [],
      level: topicDetails?.level || 0,
      failedQuestions: beta
    };

    console.log('Final Weak Learning Objective for Results:', {
      name: weakLOResult.name,
      mastery: (weakLOResult.mastery * 100).toFixed(1),
      confidence: (weakLOResult.confidence * 100).toFixed(1),
      questionsAsked: weakLOResult.questionsAsked,
      failedQuestions: weakLOResult.failedQuestions.toFixed(0),
      lcb: (weakLOResult.lcb * 100).toFixed(1),
      ucb: (weakLOResult.ucb * 100).toFixed(1),
    });

    return {
      id: weakLOResult.id,
      assessment_id: this.currentSession?.id || 0,
      question_id: 0,
      student_id: this.studentId,
      is_correct: false,
      difficulty_level: 1.0, // Default difficulty level
      pseudo_rewards: this.calculatePseudoRewards(weakLOResult.id, false),
      confidence_bounds: {
        lower: lcb,
        upper: ucb,
        mean: mastery
      },
      created_at: new Date(),
      totalQuestions: this._studentState.totalQuestions
    };
  }

  // Fixed getQuestionLimits to be public
  public getQuestionLimits(): {
    total: { current: number; max: number; };
    perTopic: { min: number; max: number; };
  } {
    return {
      total: { current: this._studentState.totalQuestions, max: this.config.maxQuestions },
      perTopic: { min: this.config.preSampleCount, max: this.config.preSampleCount * 2 } // Use preSampleCount as base for per-topic limits
    };
  }

  public async startAssessment(): Promise<AssessmentSession> {
    try {
      console.log('Starting assessment for course:', this.courseId, 'chapter:', this.chapterId);

      // First, end any existing session for this chapter
      const { data: existingSessions, error: findError } = await this.supabase
          .from('assessment_sessions')
          .select('*')
          .eq('student_id', this.studentId)
          .eq('course_id', this.courseId)
          .eq('chapter_id', this.chapterId)
          .eq('status', 'in_progress');

      if (findError) {
          console.error('Error finding existing sessions:', findError);
          throw findError;
      }

      // End all existing sessions
      if (existingSessions && existingSessions.length > 0) {
          console.log('Ending existing sessions:', existingSessions.length);
          for (const session of existingSessions) {
              await this.supabase
                  .from('assessment_sessions')
                  .update({
                      status: 'abandoned',
                      end_time: new Date().toISOString()
                  })
                  .eq('id', session.id);
          }
      }

      // Create new session
      const sessionData = {
          student_id: this.studentId,
          course_id: this.courseId,
          chapter_id: this.chapterId,
          start_time: new Date().toISOString(),
          status: 'in_progress',
          sampling_policy: this.config.sampling_policy,
          max_questions: this.config.maxQuestions,
          pre_sample_count: this.config.preSampleCount,
          pre_sample_completed: false,
          pre_sample_progress: this.topics.map(topic => ({
              lo_id: topic.id,
              questions_asked: 0
          })),
          questions_asked: 0
      };

      console.log('Creating new session with data:', sessionData);

      // Insert the new session (do not use .select().single())
      const { error: insertError } = await this.supabase
          .from('assessment_sessions')
          .insert(sessionData);

      if (insertError) {
          console.error('Error creating new session:', insertError);
          throw insertError;
      }

      // Select the session just created (latest for this user/chapter)
      const { data: newSession, error: selectError } = await this.supabase
          .from('assessment_sessions')
          .select('*')
          .eq('student_id', this.studentId)
          .eq('course_id', this.courseId)
          .eq('chapter_id', this.chapterId)
          .order('start_time', { ascending: false })
          .limit(1)
          .single();

      if (selectError || !newSession) {
          console.error('Error fetching new session after insert:', selectError);
          throw new Error('Failed to fetch new session after insert');
      }

      console.log('Created new session:', newSession);
      this.currentSession = newSession;

      // Initialize sampling policy with all topics for new session
      this.samplingPolicy.reset(this.topics);
      console.log('Initialized sampling policy with topics:', {
          totalTopics: this.topics.length,
          availableTopics: this.samplingPolicy.A.size,
          topicIds: Array.from(this.samplingPolicy.A)
      });

      // Reset student state for new session
      this._studentState = new StudentStateImpl();
      this.weakKC = null;

      return newSession;
    } catch (error) {
      console.error('Error in startAssessment:', error);
      throw error;
    }
  }

  public getConfig(): AssessmentConfig { return this.config; }
  // Keep only one studentState getter
  public get studentState(): StudentState { return this._studentState; }

  // This function is for providing a learning path, but is not core to the MAB assessment stopping.
  public getLearningPathForWeakTopics(): {
    weakTopics: Array<{ id: number; name: string; mastery: number; prerequisites: number[]; level: number; }>;
    learningPath: Array<{ id: number; name: string; level: number; isPrerequisite: boolean; }>;
  } {
    const potentiallyWeakTopics = this.topics.filter(topic => {
      const state = this._studentState.topicMastery.get(topic.id);
      if (!state || (state.alpha + state.beta) < this.config.preSampleCount) {
        return false;
      }
      return empiricalMean(state.alpha, state.beta) < this.config.masteryThreshold;
    });

    const sortedWeakTopics = potentiallyWeakTopics
      .sort((a, b) => {
        const masteryA = this._studentState.topicMastery.get(a.id)?.mastery || 0;
        const masteryB = this._studentState.topicMastery.get(b.id)?.mastery || 0;
        return masteryA - masteryB;
      })
      .slice(0, Math.min(5, potentiallyWeakTopics.length)); // Limit to top 5 weak topics for practical display

    const weakTopicsForUI = sortedWeakTopics.map(t => ({
      id: t.id,
      name: t.name,
      mastery: empiricalMean(this._studentState.topicMastery.get(t.id)!.alpha, this._studentState.topicMastery.get(t.id)!.beta),
      prerequisites: t.prerequisites,
      level: t.level
    }));

    const learningPathSet = new Set<number>();
    const queue: number[] = sortedWeakTopics.map(t => t.id);
    const visited = new Set<number>();

    while (queue.length > 0) {
      const currentTopicId = queue.shift()!;
      if (visited.has(currentTopicId)) continue;
      visited.add(currentTopicId);

      learningPathSet.add(currentTopicId); // Add the topic itself

      const currentTopic = this.topics.find(t => t.id === currentTopicId);
      if (currentTopic) {
        currentTopic.prerequisites.forEach(prereqId => {
          if (!visited.has(prereqId)) {
            queue.push(prereqId);
          }
        });
      }
    }

    const sortedPath = Array.from(learningPathSet)
      .map(id => {
        const topic = this.topics.find(t => t.id === id);
        return {
          id,
          name: topic?.name || '',
          level: topic?.level || 0,
          isPrerequisite: !weakTopicsForUI.some(wt => wt.id === id) // True if it's a prereq, not the weak topic itself
        };
      })
      .sort((a, b) => a.level - b.level);

    return { weakTopics: weakTopicsForUI, learningPath: sortedPath };
  }

  public async loadStudentHistory(): Promise<void> {
    try {
      const { data: masteryRecords, error } = await this.supabase
        .from('student_lo_mastery')
        .select('*')
        .eq('student_id', this.studentId)
        .eq('chapter_id', this.chapterId)
        .eq('course_id', this.courseId);

      if (error) {
        console.error('Error loading student history:', error);
        return;
      }

      if (masteryRecords) {
        masteryRecords.forEach((record: MasteryRecord) => {
          const topicId = record.lo_id;
          const existingState = this._studentState.topicMastery.get(topicId);
          
          // Helper function to safely parse performance history
          const parsePerformanceHistory = (history: any): any[] => {
            if (!history) return [];
            if (typeof history === 'string') {
              try {
                return JSON.parse(history);
              } catch (e) {
                console.warn(`Failed to parse performance history for topic ${topicId}:`, e);
                return [];
              }
            }
            // If it's already an object/array, return it directly
            return Array.isArray(history) ? history : [];
          };
          
          if (existingState) {
            // Update existing state with historical data
            existingState.alpha = record.alpha;
            existingState.beta = record.beta;
            existingState.mastery = empiricalMean(record.alpha, record.beta);
            existingState.confidence = this.calculateConfidenceMetric(record.alpha, record.beta);
            existingState.historicalQuestionsAsked = record.alpha + record.beta - 2; // Subtract initial Beta(1,1)
            existingState.performanceHistory = parsePerformanceHistory(record.performance_history);
          } else {
            // Create new state with historical data
            this._studentState.topicMastery.set(topicId, {
              alpha: record.alpha,
              beta: record.beta,
              mastery: empiricalMean(record.alpha, record.beta),
              confidence: this.calculateConfidenceMetric(record.alpha, record.beta),
              questionsAsked: 0,
              historicalQuestionsAsked: record.alpha + record.beta - 2,
              lastUpdated: new Date(record.last_updated),
              performanceHistory: parsePerformanceHistory(record.performance_history)
            });
          }
        });
      }
    } catch (error) {
      console.error('Error in loadStudentHistory:', error);
    }
  }

  private calculatePseudoRewards(topicId: number, isCorrect: boolean): { topicId: number; reward: number; graph: 'AND' | 'OR' }[] {
    const topic = this.topics.find(t => t.id === topicId);
    if (!topic) return [];

    const rewards: { topicId: number; reward: number; graph: 'AND' | 'OR' }[] = [];
    
    // Add reward for the current topic
    rewards.push({
      topicId,
      reward: isCorrect ? 1 : 0,
      graph: 'AND'
    });

    // Add rewards for prerequisites
    if (topic.prerequisites) {
      topic.prerequisites.forEach(prereqId => {
        rewards.push({
          topicId: prereqId,
          reward: isCorrect ? this.pseudoRewardFactor : 0,
          graph: 'OR'
        });
      });
    }

    return rewards;
  }

  private calculateLCB(alpha: number, beta: number): number {
    const delta = this.config.confidenceThreshold;
    const validAlpha = Math.max(0.001, alpha);
    const validBeta = Math.max(0.001, beta);
    return jStat.beta.inv(delta / 2, validAlpha, validBeta);
  }

  private calculateUCB(alpha: number, beta: number): number {
    const delta = this.config.confidenceThreshold;
    const validAlpha = Math.max(0.001, alpha);
    const validBeta = Math.max(0.001, beta);
    return jStat.beta.inv(1 - delta / 2, validAlpha, validBeta);
  }

  public async processAnswer(questionId: number, isCorrect: boolean): Promise<AssessmentEndResult | null> {
    try {
      if (!this.currentSession) {
        console.warn('Attempted to process answer with no active session.');
        return null;
      }

      const question = this.questions.find(q => q.id === questionId);
      if (!question) {
        console.error(`Question ${questionId} not found`);
        return null;
      }

      const topicId = question.topic_id;
      if (!topicId) {
        console.error(`No topic ID found for question ${questionId}`);
        return null;
      }
    
      // 1. Update topic mastery with direct answer
      this.updateTopicMastery(topicId, isCorrect);

      // 2. Apply pseudo-rewards to dependent topics
      await this.applyPseudoRewards(topicId, isCorrect);

      // Get current state for logging and result
      const state = this._studentState.topicMastery.get(topicId);
      if (!state) {
        console.error(`No mastery state found for topic ${topicId}`);
        return null;
      }

      // Update session questions asked count
      this.currentSession.questions_asked++;
      this._studentState.totalQuestions++;

      // Update pre-sample progress in database
      if (this.isPreSamplePhase()) {
        const progress = this.currentSession.pre_sample_progress.find(p => p.lo_id === topicId);
        if (progress) {
          progress.questions_asked++;
        } else {
          this.currentSession.pre_sample_progress.push({
            lo_id: topicId,
            questions_asked: 1
          });
        }

        // Update the database
        const { error: updateError } = await this.supabase
          .from('assessment_sessions')
          .update({
            questions_asked: this.currentSession.questions_asked,
            pre_sample_progress: this.currentSession.pre_sample_progress
          })
          .eq('id', this.currentSession.id);

        if (updateError) {
          console.error('Error updating session progress:', updateError);
          return null;
        }
      } else {
        // Update questions_asked in database for adaptive phase
        const { error: updateError } = await this.supabase
          .from('assessment_sessions')
          .update({
            questions_asked: this.currentSession.questions_asked
          })
          .eq('id', this.currentSession.id);

        if (updateError) {
          console.error('Error updating session questions asked:', updateError);
          return null;
        }
      }

      // 3. Update MAB policy state and check for weak KC only in adaptive phase
      if (!this.isPreSamplePhase()) {
        const weakStatus = this.samplingPolicy.updateAfterAnswer(
          topicId,
          state.alpha,
          state.beta,
          this.config.masteryThreshold,
          this.config.confidenceThreshold,
          this.topics.length,
          this._studentState.totalQuestions
        );

        if (weakStatus === 'weak') {
          const topic = this.topics.find(t => t.id === topicId);
          if (topic) {
            this.weakKC = {
              topicId: topic.id,
              name: topic.name,
              mastery: empiricalMean(state.alpha, state.beta),
              confidence: 1 - state.confidence,
              questionsAsked: state.questionsAsked,
              successRate: state.questionsAsked > 0 ? state.alpha / state.questionsAsked : 0,
              alpha: state.alpha,
              beta: state.beta,
              prerequisites: topic.prerequisites,
              level: topic.level,
            };
            // End assessment and return result
            return await this.endAssessment();
          }
        }
      }

      // 4. Save assessment result
      const result = {
        assessment_id: this.currentSession.id,
        question_id: questionId,
        student_id: this.studentId,
        is_correct: isCorrect,
        difficulty_level: question.difficulty,
        pseudo_rewards: this.calculatePseudoRewards(topicId, isCorrect),
        confidence_bounds: {
          lower: this.calculateLCB(state.alpha, state.beta),
          upper: this.calculateUCB(state.alpha, state.beta),
          mean: empiricalMean(state.alpha, state.beta)
        },
        created_at: new Date()
      };

      const { error } = await this.supabase
        .from('assessment_results')
        .insert([result]);

      if (error) {
        console.error('Error saving assessment result:', error);
        return null;
      }

      console.log(`Processed answer for question ${questionId}:`, {
        isCorrect,
        topicId,
        mastery: empiricalMean(state.alpha, state.beta),
        confidence: 1 - state.confidence,
        weakStatus: !this.isPreSamplePhase() ? this.samplingPolicy.updateAfterAnswer(
          topicId,
          state.alpha,
          state.beta,
          this.config.masteryThreshold,
          this.config.confidenceThreshold,
          this.topics.length,
          this._studentState.totalQuestions
        ) : null,
        weakKC: this.weakKC ? this.weakKC.name : null,
        phase: this.getCurrentPhase(),
        sessionQuestionsAsked: this.currentSession.questions_asked,
        totalQuestions: this._studentState.totalQuestions
      });

      return null; // Return null if assessment continues
    } catch (error) {
      console.error('Error processing answer:', error);
      return null;
    }
  }

  public getWeakKC(): WeakKC | null {
    return this.weakKC;
  }

  public async getNextQuestion(): Promise<Question | null> {
    try {
      if (!this.currentSession) {
        throw new Error('No active assessment session');
      }

      // If assessment has ended (weak KC found or max questions reached), return null
      if (!this.isSessionActive()) {
        console.log('Assessment has ended, no more questions');
        return null;
      }

      console.log('Getting next question:', {
        sessionId: this.currentSession.id,
        questionsAsked: this.currentSession.questions_asked,
        maxQuestions: this.config.maxQuestions,
        totalTopics: this.topics.length,
        topicsWithQuestions: this.topics.filter(t => t.questions.length > 0).length,
        weakKC: this.weakKC?.name || null,
        phase: this.getCurrentPhase()
      });

      // Check stopping conditions
      if (this.currentSession.questions_asked >= this.config.maxQuestions) {
        console.log('Maximum number of questions reached for this session');
        await this.endAssessment();
        return null;
      }

      // If we have identified a weak KC in adaptive phase, end the assessment
      if (!this.isPreSamplePhase() && this.weakKC) {
        console.log('Weak KC identified:', this.weakKC.name);
        await this.endAssessment();
        return null;
      }

      // Get current phase
      const currentPhase = this.getCurrentPhase();
      console.log('Current phase:', currentPhase);

      if (currentPhase === 'pre-sample') {
        // Find LOs in this chapter that need pre-sample questions
        const incompleteLOs = this.topics.filter(topic => {
          const progress = this.currentSession?.pre_sample_progress.find(
            p => p.lo_id === topic.id
          );
          const needsMore = !progress || progress.questions_asked < this.config.preSampleCount;
          console.log(`Topic ${topic.id} (${topic.name}):`, {
            progress: progress?.questions_asked || 0,
            needed: this.config.preSampleCount,
            hasQuestions: topic.questions.length,
            needsMore
          });
          return needsMore;
        });

        console.log('Incomplete LOs:', incompleteLOs.length);

        if (incompleteLOs.length === 0) {
          // All LOs in this chapter have completed pre-sample
          console.log('Pre-sample phase completed for chapter', this.chapterId);
          // Update session to mark pre-sample as completed
          await this.supabase
            .from('assessment_sessions')
            .update({ pre_sample_completed: true })
            .eq('id', this.currentSession.id);
          this.currentSession.pre_sample_completed = true;
            return null;
          }
          
        // Select a random incomplete LO
        const randomIndex = Math.floor(Math.random() * incompleteLOs.length);
        const selectedTopic = incompleteLOs[randomIndex];
        return this.selectQuestion(selectedTopic.id);
      } else {
        // Adaptive phase
        const selectedTopicId = this.samplingPolicy.selectTopic(this.topics, this._studentState);
        if (selectedTopicId === -1) {
          console.log('No topics available for selection');
          await this.endAssessment();
          return null;
        }
        return this.selectQuestion(selectedTopicId);
      }
    } catch (error) {
      console.error('Error getting next question:', error);
        return null;
    }
  }

  public async saveAssessmentResults(): Promise<void> {
    if (!this.currentSession) {
      console.warn('No active assessment session to save results for.');
      return;
    }

    try {
      // Update session status
      const { error: sessionError } = await this.supabase
        .from('assessment_sessions')
        .update({
          end_time: new Date(),
          status: 'completed'
        })
        .eq('id', this.currentSession.id);

      if (sessionError) throw sessionError;

      // Save mastery records
      try {
        const masteryStates = Array.from(this._studentState.topicMastery.entries()).map(
          ([topicId, state]) => ({
            student_id: this.studentId,
            lo_id: topicId,
            chapter_id: this.chapterId,
            course_id: this.courseId,
            alpha: state.alpha,
            beta: state.beta,
            last_updated: new Date().toISOString(),
            performance_history: JSON.stringify(state.performanceHistory || [])
          })
        );

        if (masteryStates.length > 0) {
          // First try to update existing records
          for (const state of masteryStates) {
            const { error: updateError } = await this.supabase
              .from('student_lo_mastery')
              .update({
                alpha: state.alpha,
                beta: state.beta,
                last_updated: state.last_updated,
                performance_history: state.performance_history
              })
              .match({
                student_id: state.student_id,
                lo_id: state.lo_id,
                chapter_id: state.chapter_id,
                course_id: state.course_id
              });

            if (updateError) {
              // If update fails (record doesn't exist), try insert
              const { error: insertError } = await this.supabase
                .from('student_lo_mastery')
                .insert([state]);

              if (insertError) {
                console.error('Error saving mastery state:', insertError);
                // Continue with other records even if one fails
                continue;
              }
            }
          }
        }
      } catch (masteryError) {
        console.error('Error in mastery state update:', masteryError);
        // Don't throw here - we still want to complete the session
      }
    } catch (error) {
      console.error('Error saving assessment results:', error);
      throw error;
    }
  }

  public static async initializeFromDatabase(
    courseId: number,
    chapterId: number,
    userId: number,
    supabase: any,
    config: Partial<AssessmentConfig> = {}
  ): Promise<AdaptiveAssessmentSystem> {
    try {
      console.log('Initializing from database for course:', courseId, 'chapter:', chapterId);

      // 1. Get chapter data
      const { data: chapterData, error: chapterError } = await supabase
        .from('chapters')
        .select('*')
        .eq('id', chapterId)
        .eq('course_id', courseId)
        .single();

      if (chapterError) {
        console.error('Error fetching chapter:', chapterError);
        throw chapterError;
      }

      if (!chapterData) {
        throw new Error(`Chapter ${chapterId} not found in course ${courseId}`);
      }

      console.log('Chapter data loaded:', chapterData);

      // 2. Get learning objectives for this chapter
      const { data: losData, error: losError } = await supabase
        .from('learning_objectives')
        .select('*')
        .eq('chapter_id', chapterId);

      if (losError) {
        console.error('Error fetching learning objectives:', losError);
        throw losError;
      }

      if (!losData || losData.length === 0) {
        throw new Error('No learning objectives found for this chapter');
      }

      console.log('Learning objectives loaded:', {
        count: losData.length,
        los: losData.map((lo: { id: number; title: string }) => ({ id: lo.id, name: lo.title }))
      });

      // 3. Get LO dependencies
      const { data: loDependenciesData, error: loDependenciesError } = await supabase
        .from('lo_dependencies')
        .select('dependent_lo_id, graph')
        .in('dependent_lo_id', losData.map((lo: any) => lo.id));

      if (loDependenciesError) {
        console.error('Error fetching LO dependencies:', loDependenciesError);
      }

      console.log('LO dependencies loaded:', {
        count: loDependenciesData?.length || 0
      });

      const loPrerequisitesMap = new Map<number, number[]>();
      loDependenciesData?.forEach((dep: any) => {
        if (!loPrerequisitesMap.has(dep.dependent_lo_id)) {
          loPrerequisitesMap.set(dep.dependent_lo_id, []);
        }
        loPrerequisitesMap.get(dep.dependent_lo_id)?.push(dep.lo_id);
      });

      // 4. Get questions for these LOs
      const { data: questionLosData, error: questionLosError } = await supabase
        .from('question_lo')
        .select('*')
        .in('lo_id', losData.map((lo: any) => lo.id));

      if (questionLosError) {
        console.error('Error fetching question-LO mappings:', questionLosError);
        throw questionLosError;
      }

      if (!questionLosData || questionLosData.length === 0) {
        throw new Error('No questions mapped to learning objectives in this chapter');
      }

      console.log('Question-LO mappings loaded:', {
        count: questionLosData.length,
        uniqueQuestions: new Set(questionLosData.map((qlo: any) => qlo.question_id)).size
      });
      
      const questionIds = [...new Set(questionLosData?.map((qlo: any) => qlo.question_id) || [])];

      // 5. Get questions with choices
      const { data: questionsWithChoices, error: questionsError } = await supabase
        .from('questions')
        .select(`id, question_rich_text, explanation, difficulty, concept_weight, time_decay_factor, choices (id, question_id, choice, is_correct)`)
        .in('id', questionIds);

      if (questionsError) {
        console.error('Error fetching questions:', questionsError);
        throw questionsError;
      }

      if (!questionsWithChoices || questionsWithChoices.length === 0) {
        throw new Error('No questions found for this chapter');
      }

      console.log('Questions loaded:', {
        count: questionsWithChoices.length,
        questionsWithChoices: questionsWithChoices.length,
        questionsWithValidChoices: questionsWithChoices.filter((q: { choices: any[] }) => q.choices && q.choices.length > 0).length
      });

      // 6. Process questions and topics
      const allQuestions: Question[] = [];
      const topics: Topic[] = losData.map((lo: any) => {
        const loQuestionIds = questionLosData?.filter((qlo: any) => qlo.lo_id === lo.id)
          .map((qlo: any) => qlo.question_id) || [];
        const loQuestions: Question[] = questionsWithChoices
          .filter((q: any) => loQuestionIds.includes(q.id))
          .map((q: any): Question | null => {
            if (!q.choices || q.choices.length === 0) {
              console.warn(`Question ${q.id} has no choices. Skipping.`);
              return null;
            }

            const choices = q.choices.map((c: any) => ({
              id: c.id,
              question_id: c.question_id,
              choice: c.choice,
              is_correct: c.is_correct
            }));

            const correctOption = choices.findIndex((c: any) => c.is_correct);
            if (correctOption === -1) {
              console.warn(`Question ${q.id} has no correct option. Skipping.`);
              return null;
            }

            if (!q.question_rich_text) {
              console.warn(`Question ${q.id} has no content. Skipping.`);
              return null;
            }

            const questionInstance: Question = {
              id: q.id,
              question_rich_text: q.question_rich_text,
              explanation: q.explanation,
              difficulty: q.difficulty || 1.0,
              concept_weight: q.concept_weight || 1.0,
              time_decay_factor: q.time_decay_factor || 0.1,
              choices: choices,
              correctOption,
              topic_id: lo.id,
              hasBeenAsked: false
            };

            allQuestions.push(questionInstance);
            return questionInstance;
          }).filter((q: Question | null): q is Question => q !== null);

        return {
          id: lo.id,
          name: lo.title,
          description: lo.description,
          lo_code: lo.lo_code,
          mastery_threshold: lo.mastery_threshold || config.masteryThreshold || 0.7,
          confidence_delta: lo.confidence_delta || config.confidenceThreshold || 0.05,
          min_samples: lo.min_samples || config.preSampleCount || 1,
          difficulty: lo.difficulty || 1.0,
          concept_weight: lo.concept_weight || 1.0,
          time_decay_factor: lo.time_decay_factor || 0.1,
          questions: loQuestions,
          hasBeenAsked: false,
          alpha: 1.0,
          beta: 1.0,
          prerequisites: loPrerequisitesMap.get(lo.id) || [],
          level: lo.level || 0,
          questionsAsked: 0,
          successRate: 0,
          mastery: 0.5,
          confidence: 0.5,
          lcb: 0,
          ucb: 1,
          failedQuestions: 0
        };
      }).filter((topic: Topic) => topic.questions.length > 0);

      console.log('Processed topics:', {
        totalTopics: topics.length,
        topicsWithQuestions: topics.filter(t => t.questions.length > 0).length,
        totalQuestions: allQuestions.length,
        questionsPerTopic: topics.map(t => ({
          id: t.id,
          name: t.name,
          questionCount: t.questions.length
        }))
      });

      if (topics.length === 0) {
        throw new Error('No topics with valid questions found for this chapter.');
      }

      const assessment = new AdaptiveAssessmentSystem(
        courseId,
        chapterId,
        userId,
        supabase,
        {
          masteryThreshold: config.masteryThreshold || 0.7,
          confidenceThreshold: config.confidenceThreshold || 0.05,
          preSampleCount: config.preSampleCount || 1,
          maxQuestions: config.maxQuestions || 50,
          sampling_policy: config.sampling_policy || 'HDoC'
        }
      );

      assessment.topics = topics;
      assessment.questions = allQuestions;
      assessment.questionToTopicMap = new Map(allQuestions.map((q, index) => [q.id, q.topic_id]));
      assessment.isInitialized = true;
      assessment.sessionId = null;
      assessment.sessionStartTime = null;
      assessment.questionsAsked = 0;
      assessment.currentPhase = 'pre_sample';
      assessment.preSampleCounts = new Map();
      assessment.weakKC = null;
      assessment.randomSeed = Math.random();
      assessment.samplingPolicy = new HDoCPolicy();
      assessment._studentState = new StudentStateImpl();

      // Initialize pre-sample progress tracking
      topics.forEach(topic => {
        assessment.preSampleProgress.set(topic.id, 0);
      });

      console.log('AdaptiveAssessmentSystem instance created successfully.');
      return assessment;
    } catch (error) {
      console.error('Error in AdaptiveAssessmentSystem.initializeFromDatabase:', error);
      throw error;
    }
  }

  private checkStoppingConditions(): boolean {
    // 1. Check if max questions budget is reached
    if (this._studentState.totalQuestions >= this.config.maxQuestions) {
      console.log('Stopping: Max questions budget reached.');
      return true;
    }

    // 2. Check if we're in pre-sample phase
    if (this.isPreSamplePhase()) {
      return false; // Don't stop during pre-sample unless budget is exhausted
    }

    // 3. Check if a weak KC has been confidently identified
    if (this.weakKC) {
        console.log(`Stopping: Weak KC (${this.weakKC.name}) identified in processAnswer.`);
          return true;
    }

    // 4. Check if all available topics are considered "strong"
    const availableTopics = this.topics.filter(t => this.samplingPolicy.A.has(t.id));
    if (availableTopics.length === 0) {
      console.log('Stopping: All available topics are considered strong/mastered.');
      return true;
    }

    return false;
  }

  private isPreSamplePhase(): boolean {
    if (!this.currentSession) return false;
    
    console.log('Checking pre-sample phase:', {
      sessionId: this.currentSession.id,
      preSampleCompleted: this.currentSession.pre_sample_completed,
      preSampleProgress: this.currentSession.pre_sample_progress,
      requiredSamples: this.config.preSampleCount
    });

    // Check if pre-sample is marked as completed in the session
    if (this.currentSession.pre_sample_completed) {
      console.log('Pre-sample already completed for this session');
      return false;
    }

    // Check if all topics in this chapter have completed their pre-samples
    const allTopicsCompleted = this.topics.every(topic => {
      const progress = this.currentSession?.pre_sample_progress.find(
        p => p.lo_id === topic.id
      );
      const completed = progress && progress.questions_asked >= this.config.preSampleCount;
      console.log(`Topic ${topic.id} pre-sample progress:`, {
        required: this.config.preSampleCount,
        current: progress?.questions_asked || 0,
        completed
      });
      return completed;
    });

    if (allTopicsCompleted) {
      console.log('All topics have completed pre-sample phase');
      // Update session to mark pre-sample as completed
      this.supabase
        .from('assessment_sessions')
        .update({ pre_sample_completed: true })
        .eq('id', this.currentSession.id);
      this.currentSession.pre_sample_completed = true;
      return false;
    }

    console.log('Still in pre-sample phase');
    return true;
  }

  private selectQuestion(topicId: number): Question | null {
    const topic = this.topics.find(t => t.id === topicId);
    if (!topic) {
      console.warn(`Topic ${topicId} not found`);
      this.samplingPolicy.A.delete(topicId);
      return null;
    }

    const availableQuestions = topic.questions.filter(q => !this._studentState.answeredQuestions.has(q.id));
    console.log(`Selecting question for topic ${topicId} (${topic.name}). Available questions:`, availableQuestions.map(q => q.id));

    if (availableQuestions.length === 0) {
      console.warn(`No available questions for topic ${topicId}`);
      this.samplingPolicy.A.delete(topicId);
      return null;
    }

    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    return availableQuestions[randomIndex];
  }

  private getSamplingPolicyEnum(): 'Thompson' | 'HDoC' | 'Random' {
    const name = this.samplingPolicy.getName();
    if (name === 'Thompson Sampling' || name === 'Thompson') return 'Thompson';
    if (name === 'HDoC') return 'HDoC';
    if (name === 'Random') return 'Random';
    throw new Error('Unknown sampling policy');
  }

  public isSessionActive(): boolean {
    return this.currentSession !== null && this.currentSession.status === 'in_progress';
  }

  public getSessionId(): number | null {
    return this.currentSession?.id || null;
  }

  public getCurrentPhase(): 'pre-sample' | 'adaptive' {
    return this.isPreSamplePhase() ? 'pre-sample' : 'adaptive';
  }

  private async endAssessment(): Promise<AssessmentEndResult> {
    try {
      if (!this.currentSession) {
        throw new Error('No active session to end');
      }

      console.log('Starting assessment end process:', {
        sessionId: this.currentSession.id,
        questionsAsked: this.currentSession.questions_asked,
        preSampleCompleted: this.currentSession.pre_sample_completed,
        weakKC: this.weakKC?.name || null,
        weakKCState: this.weakKC ? this._studentState.topicMastery.get(this.weakKC.topicId) : null
      });

      // Step 1: Prepare end result data
      const endResult = await this.prepareAssessmentEndResult();
      console.log('Prepared assessment end result:', { 
        sessionId: endResult.sessionId, 
        questionsAsked: endResult.questionsAsked, 
        weakKC: endResult.weakKC?.name || null,
        masteryStatesCount: endResult.masteryStates.size
      });

      // Step 2: Save mastery states - Ensure this happens BEFORE session reset
      await this.saveMasteryStates(endResult.masteryStates);
      console.log('Mastery states saved successfully.');

      // Step 3: Update session status
      const { error: updateError } = await this.supabase
        .from('assessment_sessions')
        .update({
          status: 'completed',
          end_time: new Date().toISOString(),
          questions_asked: this.currentSession.questions_asked
        })
        .eq('id', this.currentSession.id);

      if (updateError) {
        console.error('Error updating session status:', updateError);
        throw updateError;
      }

      // Step 4: Clean up session state
      const weakKC = this.weakKC; // Store weakKC before reset
      this.currentSession = null;
      this.sessionId = null;
      this.sessionStartTime = null;
      this.questionsAsked = 0;
      this.currentPhase = 'pre_sample';
      this.preSampleCounts.clear();
      this.weakKC = weakKC; // Restore weakKC after reset for returning in endResult
      // Only reset sampling policy if no weak KC was found
      if (!weakKC) {
        this.samplingPolicy.reset(this.topics);
      }
      this._studentState = new StudentStateImpl();

      console.log('Assessment session ended successfully', {
        sessionId: endResult.sessionId,
        questionsAsked: endResult.questionsAsked,
        weakKC: endResult.weakKC ? {
          topicId: endResult.weakKC.topicId,
          name: endResult.weakKC.name,
          mastery: endResult.weakKC.mastery,
          confidence: endResult.weakKC.confidence,
          questionsAsked: endResult.weakKC.questionsAsked
        } : null
      });

      return endResult;
    } catch (error) {
      console.error('Error ending assessment:', error);
      throw error;
    }
  }

  private async prepareAssessmentEndResult(): Promise<AssessmentEndResult> {
    if (!this.currentSession) {
      throw new Error('No active session to prepare end result');
    }

    // Get current mastery states
    const masteryStates = new Map(this._studentState.topicMastery);

    return {
      sessionId: this.currentSession.id,
      questionsAsked: this.currentSession.questions_asked,
      weakKC: this.weakKC,
      masteryStates
    };
  }

  private async saveMasteryStates(masteryStates: Map<number, TopicMasteryState>): Promise<void> {
    try {
      const masteryRecords = Array.from(masteryStates.entries()).map(
          ([topicId, state]) => ({
            student_id: this.studentId,
            lo_id: topicId,
            chapter_id: this.chapterId,
            course_id: this.courseId,
            alpha: state.alpha,
            beta: state.beta,
            last_updated: new Date().toISOString(),
            performance_history: JSON.stringify(state.performanceHistory || [])
          })
        );

      if (masteryRecords.length > 0) {
        for (const record of masteryRecords) {
            // Try to update existing record
            const { error: updateError } = await this.supabase
              .from('student_lo_mastery')
              .update({
              alpha: record.alpha,
              beta: record.beta,
              last_updated: record.last_updated,
              performance_history: record.performance_history
              })
              .match({
              student_id: record.student_id,
              lo_id: record.lo_id,
              chapter_id: record.chapter_id,
              course_id: record.course_id
              });

            if (updateError) {
              // If update fails (record doesn't exist), try insert
              const { error: insertError } = await this.supabase
                .from('student_lo_mastery')
              .insert([record]);

              if (insertError) {
                console.error('Error saving mastery state:', insertError);
                continue;
              }
            }
          }
        }
    } catch (error) {
      console.error('Error saving mastery states:', error);
      throw error;
    }
  }
}

// Export types at the end of the file
export type { 
    Topic, 
    Question, 
    AssessmentConfig, 
    StudentState, 
    SamplingPolicy, 
    WeakKC, 
    AssessmentResult,
    AssessmentEndResult,
    TopicMasteryState,
    AdaptiveAssessmentSystem as AdaptiveAssessmentSystemType 
};

// Helper function to match Python's max
function max(a: number, b: number): number {
    return a > b ? a : b;
}
