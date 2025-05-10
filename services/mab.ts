export class LearningObjective {
  id: string
  name: string
  chapter: string
  section: string
  alpha: number
  beta: number
  prerequisites: string[]
  level: number
  mastery_threshold: number
  confidence_delta: number
  min_samples: number
  difficulty: number
  performance_history: { timestamp: number; success: boolean; difficulty: number }[]
  concept_weight: number
  time_decay_factor: number
  dependencies: Map<string, 'AND' | 'OR'>

  constructor(
    id: string, 
    name: string,
    chapter: string,
    section: string,
    alpha: number = 1.0,
    beta: number = 1.0,
    prerequisites: string[] = [],
    mastery_threshold: number = 0.6,
    confidence_delta: number = 0.05,
    min_samples: number = 5,
    difficulty: number = 1.0,
    concept_weight: number = 1.0,
    time_decay_factor: number = 0.1,
    dependencies: Map<string, 'AND' | 'OR'> = new Map()
  ) {
    this.id = id
    this.name = name
    this.chapter = chapter
    this.section = section
    this.alpha = alpha
    this.beta = beta
    this.prerequisites = prerequisites
    this.level = 0
    this.mastery_threshold = mastery_threshold
    this.confidence_delta = confidence_delta
    this.min_samples = min_samples
    this.difficulty = difficulty
    this.performance_history = []
    this.concept_weight = concept_weight
    this.time_decay_factor = time_decay_factor
    this.dependencies = dependencies
  }

  private calculate_time_weight(timestamp: number): number {
    const now = Date.now()
    const hoursSinceAttempt = (now - timestamp) / (1000 * 60 * 60)
    return Math.exp(-this.time_decay_factor * hoursSinceAttempt)
  }

  private calculate_weighted_mastery(): number {
    if (this.performance_history.length === 0) return 0.5

    let totalWeight = 0
    let weightedSum = 0

    this.performance_history.forEach(record => {
      const timeWeight = this.calculate_time_weight(record.timestamp)
      const difficultyWeight = 1 / record.difficulty
      const weight = timeWeight * difficultyWeight * this.concept_weight
      
      totalWeight += weight
      weightedSum += (record.success ? 1 : 0) * weight
    })

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5
  }

  get_mastery(): number {
    return this.calculate_weighted_mastery()
  }

  get_confidence_interval(): number {
    const n = this.performance_history.length
    if (n === 0) return 1
    
    const weightedMastery = this.get_mastery()
    const weightedVariance = this.performance_history.reduce((sum, record) => {
      const timeWeight = this.calculate_time_weight(record.timestamp)
      const diff = (record.success ? 1 : 0) - weightedMastery
      return sum + (diff * diff * timeWeight)
    }, 0) / n

    return 1.96 * Math.sqrt(weightedVariance / n)
  }

  get_weak_probability(): number {
    const mastery = this.get_mastery()
    const ci = this.get_confidence_interval()
    return mastery <= this.mastery_threshold ? 1 - ci : ci
  }

  has_sufficient_samples(): boolean {
    return this.performance_history.length >= this.min_samples
  }

  is_weak(): boolean {
    if (!this.has_sufficient_samples()) return false
    return this.get_weak_probability() >= (1 - this.confidence_delta)
  }

  is_strong(): boolean {
    if (!this.has_sufficient_samples()) return false
    return this.get_mastery() > this.mastery_threshold + 0.1
  }

  get_hdoc_score(): number {
    const mastery = this.get_mastery()
    const ci = this.get_confidence_interval()
    return mastery - ci
  }

  update_performance(success: boolean, questionDifficulty: number): void {
    this.performance_history.push({
      timestamp: Date.now(),
      success,
      difficulty: questionDifficulty
    })

    // Keep only last 100 records to prevent memory bloat
    if (this.performance_history.length > 100) {
      this.performance_history = this.performance_history.slice(-100)
    }
  }

  get_recent_performance(windowHours: number = 24): { success: number; total: number } {
    const now = Date.now()
    const windowMs = windowHours * 60 * 60 * 1000
    
    const recentHistory = this.performance_history.filter(
      record => (now - record.timestamp) <= windowMs
    )

    return {
      success: recentHistory.filter(r => r.success).length,
      total: recentHistory.length
    }
  }

  are_prerequisites_satisfied(lo_map: Map<string, LearningObjective>): boolean {
    if (this.prerequisites.length === 0) return true

    return this.prerequisites.every(prereqId => {
      const prereq = lo_map.get(prereqId)
      if (!prereq) return false
      return prereq.get_mastery() >= prereq.mastery_threshold
    })
  }

  get_learning_path(lo_map: Map<string, LearningObjective>): LearningObjective[] {
    const path: LearningObjective[] = []
    const visited = new Set<string>()

    const dfs = (lo: LearningObjective) => {
      if (visited.has(lo.id)) return
      visited.add(lo.id)

      // Add prerequisites first
      lo.prerequisites.forEach(prereqId => {
        const prereq = lo_map.get(prereqId)
        if (prereq && !visited.has(prereq.id)) {
          dfs(prereq)
        }
      })

      path.push(lo)
    }

    dfs(this)
    return path
  }

  get_learning_potential(): number {
    const mastery = this.get_mastery()
    const confidence = this.get_confidence_interval()
    return (1 - mastery) * (1 - confidence)
  }
}

export class MABAssessment {
  los: { [key: string]: LearningObjective }
  question_history: { lo_id: string; success: boolean; difficulty: number }[]
  min_questions: number
  max_questions: number
  questions_asked: number
  sampling_policy: 'Thompson' | 'HDoC' | 'Random'
  lo_map: Map<string, LearningObjective>

  constructor(
    los: LearningObjective[],
    min_questions: number = 5,
    max_questions: number = 30,
    sampling_policy: 'Thompson' | 'HDoC' | 'Random' = 'Thompson'
  ) {
    this.los = {}
    this.lo_map = new Map()
    los.forEach(lo => {
      this.los[lo.id] = lo
      this.lo_map.set(lo.id, lo)
    })
    this.question_history = []
    this.min_questions = min_questions
    this.max_questions = max_questions
    this.questions_asked = 0
    this.sampling_policy = sampling_policy
  }

  update_belief(lo_id: string, success: boolean, difficulty: number): void {
    if (this.los[lo_id] && this.questions_asked < this.max_questions) {
      this.los[lo_id].update_performance(success, difficulty)
      this.question_history.push({ lo_id, success, difficulty })
      this.questions_asked += 1
    }
  }

  private sample_thompson(): string | null {
    const candidate_los = Object.entries(this.los)
      .filter(([_, lo]) => !lo.is_strong())
      .map(([id, lo]) => ({
        id,
        sample: Math.random() * (lo.alpha + lo.beta) < lo.alpha
      }))
      .sort((a, b) => a.sample ? 1 : -1)

    return candidate_los.length > 0 ? candidate_los[0].id : null
  }

  private sample_hdoc(): string | null {
    const candidate_los = Object.entries(this.los)
      .filter(([_, lo]) => !lo.is_strong())
      .map(([id, lo]) => ({
        id,
        score: lo.get_hdoc_score()
      }))
      .sort((a, b) => a.score - b.score)

    return candidate_los.length > 0 ? candidate_los[0].id : null
  }

  private sample_random(): string | null {
    const candidate_los = Object.entries(this.los)
      .filter(([_, lo]) => !lo.is_strong())
      .map(([id]) => id)

    if (candidate_los.length === 0) return null
    return candidate_los[Math.floor(Math.random() * candidate_los.length)]
  }

  get_next_question(): string | null {
    if (this.questions_asked >= this.max_questions) return null

    switch (this.sampling_policy) {
      case 'Thompson':
        return this.sample_thompson()
      case 'HDoC':
        return this.sample_hdoc()
      case 'Random':
        return this.sample_random()
      default:
        return this.sample_random()
    }
  }

  get_weakest_lo(): WeakLO | null {
    const weakLos = Object.values(this.los).filter(lo => 
      lo.get_mastery() < lo.mastery_threshold && 
      lo.has_sufficient_samples() &&
      lo.are_prerequisites_satisfied(this.lo_map)
    )

    if (weakLos.length === 0) return null

    weakLos.sort((a, b) => {
      const potentialDiff = b.get_learning_potential() - a.get_learning_potential()
      if (Math.abs(potentialDiff) > 0.1) return potentialDiff
      return a.get_mastery() - b.get_mastery()
    })

    const weakestLo = weakLos[0]
    const learningPath = weakestLo.get_learning_path(this.lo_map)

    return {
      id: weakestLo.id,
      title: weakestLo.name,
      lo_code: `${weakestLo.chapter} ${weakestLo.section}`,
      prerequisites: weakestLo.prerequisites,
      learning_path: learningPath.map(lo => ({
        id: lo.id,
        title: lo.name,
        lo_code: `${lo.chapter} ${lo.section}`,
        mastery: lo.get_mastery(),
        confidence: 1 - lo.get_confidence_interval()
      }))
    }
  }

  get_lo_stats(): { 
    id: string
    name: string
    mastery: number
    confidence: number
    samples: number
    recent_performance: { success: number; total: number }
  }[] {
    return Object.entries(this.los).map(([id, lo]) => ({
      id,
      name: lo.name,
      mastery: lo.get_mastery(),
      confidence: 1 - lo.get_confidence_interval(),
      samples: lo.performance_history.length,
      recent_performance: lo.get_recent_performance()
    }))
  }
}

export interface WeakLO {
  id: string
  title: string
  lo_code: string
  prerequisites: string[]
  learning_path: {
    id: string
    title: string
    lo_code: string
    mastery: number
    confidence: number
  }[]
} 