import { Topic, AssessmentConfig, StudentState, SamplingPolicy, HDoCPolicy, ThompsonSamplingPolicy, RandomPolicy, TopicMasteryState } from './adaptive-assessment.js';
import { createRandomDag, generateStudentMasteryAndParams, simulateAnswer, DAG } from './simulation-helpers.js';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Interfaces ---
interface SimulationResult {
  accuracy: number;
  avg_questions: number;
  f1_score: number;
  precision: number;
}

interface PolicyResultsByAptitude {
  [aptitude: string]: {
    [policyName: string]: SimulationResult;
  };
}

interface TopicWithTrueMastery extends Topic {
  true_mastery: number;
  questionsAsked: number;
  successRate: number;
  mastery: number;
  confidence: number;
  lastAsked: number;
  lastSuccess: boolean;
  lastAnswer: boolean;
  lcb: number;
  ucb: number;
  failedQuestions: number;
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

// --- Helper Functions ---
function getRandomAptitude(aptitudeLevel: 'weak' | 'medium' | 'strong'): number {
  switch (aptitudeLevel) {
    case 'weak':
      return 0.1 + Math.random() * 0.2; // [0.1, 0.3]
    case 'medium':
      return 0.4 + Math.random() * 0.2; // [0.4, 0.6]
    case 'strong':
      return 0.7 + Math.random() * 0.3; // [0.7, 1.0]
    default:
      return 0.1 + Math.random() * 0.9; // [0.1, 1.0]
  }
}

function createTopicsForRun(
  numKcs: number,
  graph: DAG,
  masteryGroundTruth: Map<number, number>,
  config: AssessmentConfig
): TopicWithTrueMastery[] {
  const topics: TopicWithTrueMastery[] = [];
  for (let i = 0; i < numKcs; i++) {
    const prerequisites = Array.from(graph.getPredecessors(i));
    const level = graph.getLevel(i);
    
    topics.push({
      id: i,
      name: `KC ${i}`,
      description: `KC ${i}`,
      lo_code: `KC${i}`,
      mastery_threshold: config.masteryThreshold,
      confidence_delta: config.confidenceThreshold,
      min_samples: config.preSampleCount,
      difficulty: 0.5,
      concept_weight: 1.0,
      time_decay_factor: 0.1,
      questions: [],
      hasBeenAsked: false,
      alpha: 1.0,
      beta: 1.0,
      prerequisites: prerequisites,
      level: level,
      true_mastery: masteryGroundTruth.get(i) || 0.5,
      questionsAsked: 0,
      successRate: 0,
      mastery: 0.5,
      confidence: 0,
      lastAsked: 0,
      lastSuccess: false,
      lastAnswer: false,
      lcb: 0,
      ucb: 1,
      failedQuestions: 0
    });
  }
  return topics;
}

// --- Main Simulation Function ---
async function runPolicySimulation(
  PolicyClass: new (...args: any[]) => SamplingPolicy,
  numKcs: number,
  numRuns: number,
  config: AssessmentConfig,
  aptitudeLevel: 'weak' | 'medium' | 'strong'
): Promise<SimulationResult> {
  let correctIdentificationsTotal = 0;
  const totalQuestionsAskedAcrossRuns: number[] = [];
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;

  for (let i = 0; i < numRuns; i++) {
    // 1. Initialize for this run
    const graph = createRandomDag(numKcs);
    const aptitude = getRandomAptitude(aptitudeLevel);
    const { mastery: masteryGroundTruth } = await generateStudentMasteryAndParams(
      graph, aptitude, 0.2, config.masteryThreshold
    );

    const topicsForRun = createTopicsForRun(numKcs, graph, masteryGroundTruth, config);
    const weakGroundTruthIds = new Set<number>();
    
    for (const topic of topicsForRun) {
      if (topic.true_mastery < config.masteryThreshold) {
        weakGroundTruthIds.add(topic.id);
      }
    }

    const studentState = new StudentStateImpl();
    let policy: SamplingPolicy;

    if (PolicyClass.name === "HDoCPolicy") {
      policy = new HDoCPolicy();
      (policy as HDoCPolicy).reset(topicsForRun);
    } else if (PolicyClass.name === "ThompsonSamplingPolicy") {
      policy = new ThompsonSamplingPolicy();
    } else {
      policy = new RandomPolicy();
    }
    policy.initialize(topicsForRun);

    // 2. Pre-sample phase
    for (const topic of topicsForRun) {
      for (let k = 0; k < config.preSampleCount; k++) {
        if (studentState.totalQuestions >= config.maxQuestions) break;
        
        const answer = simulateAnswer(topic.true_mastery);
        
        if (!studentState.topicMastery.has(topic.id)) {
          studentState.topicMastery.set(topic.id, {
            alpha: 1.0,
            beta: 1.0,
            mastery: 0.5,
            confidence: 0,
            questionsAsked: 0,
            historicalQuestionsAsked: 0,
            lastUpdated: new Date(),
            performanceHistory: []
          });
        }
        const currentMasteryState = studentState.topicMastery.get(topic.id)!;
        if (answer) {
          currentMasteryState.alpha += 1;
        } else {
          currentMasteryState.beta += 1;
        }
        studentState.totalQuestions += 1;
        studentState.answeredQuestions.add(studentState.totalQuestions);
        studentState.topicCounts.set(topic.id, (studentState.topicCounts.get(topic.id) || 0) + 1);
      }
      if (studentState.totalQuestions >= config.maxQuestions) break;
    }

    if (studentState.totalQuestions >= config.maxQuestions) {
      if (weakGroundTruthIds.size === 0) {
        correctIdentificationsTotal += 1;
      }
      totalQuestionsAskedAcrossRuns.push(studentState.totalQuestions);
      continue;
    }

    // 3. Adaptive phase
    let predictedWeakestIdThisRun: number | null = null;

    while (studentState.totalQuestions < config.maxQuestions && policy.A.size > 0) {
      const selectedTopicId = policy.selectTopic(topicsForRun, studentState);
      
      if (selectedTopicId === -1) break;

      const selectedTopic = topicsForRun.find(t => t.id === selectedTopicId)!;
      const answer = simulateAnswer(selectedTopic.true_mastery);
      
      const currentMasteryState = studentState.topicMastery.get(selectedTopic.id)!;
      if (answer) {
        currentMasteryState.alpha += 1;
      } else {
        currentMasteryState.beta += 1;
      }
      studentState.totalQuestions += 1;
      studentState.answeredQuestions.add(studentState.totalQuestions);
      studentState.topicCounts.set(selectedTopic.id, (studentState.topicCounts.get(selectedTopic.id) || 0) + 1);

      const N_i_t_for_selected_topic = currentMasteryState.alpha + currentMasteryState.beta - 2;

      const resultAfterAnswer = policy.updateAfterAnswer(
        selectedTopic.id,
        currentMasteryState.alpha,
        currentMasteryState.beta,
        config.masteryThreshold,
        config.confidenceThreshold,
        topicsForRun.length,
        N_i_t_for_selected_topic
      );

      if (resultAfterAnswer === 'weak') {
        predictedWeakestIdThisRun = selectedTopic.id;
        break;
      }
    }

    // 4. Calculate accuracy for this run
    let foundWeakCorrectly = false;
    if (predictedWeakestIdThisRun !== null && weakGroundTruthIds.has(predictedWeakestIdThisRun)) {
      foundWeakCorrectly = true;
      truePositives++;
    } else if (predictedWeakestIdThisRun !== null && !weakGroundTruthIds.has(predictedWeakestIdThisRun)) {
      falsePositives++;
    } else if (predictedWeakestIdThisRun === null && weakGroundTruthIds.size > 0) {
      falseNegatives++;
    }
    
    if ((weakGroundTruthIds.size > 0 && foundWeakCorrectly) ||
        (weakGroundTruthIds.size === 0 && predictedWeakestIdThisRun === null)) {
      correctIdentificationsTotal += 1;
    }
    
    totalQuestionsAskedAcrossRuns.push(studentState.totalQuestions);
  }

  const finalAccuracy = correctIdentificationsTotal / numRuns;
  const averageQuestions = totalQuestionsAskedAcrossRuns.reduce((a, b) => a + b, 0) / totalQuestionsAskedAcrossRuns.length;
  
  // Calculate precision and F1 score
  const precision = truePositives / (truePositives + falsePositives) || 0;
  const recall = truePositives / (truePositives + falseNegatives) || 0;
  const f1Score = 2 * (precision * recall) / (precision + recall) || 0;
  
  return { 
    accuracy: finalAccuracy, 
    avg_questions: averageQuestions,
    f1_score: f1Score,
    precision: precision
  };
}

// --- Main Function for Aptitude Simulation ---
async function main() {
  const baseConfig: AssessmentConfig = {
    masteryThreshold: 0.7,
    confidenceThreshold: 0.15,
    preSampleCount: 1,
    maxQuestions: 80,
    sampling_policy: 'Thompson' as 'Thompson' | 'HDoC' | 'Random'
  };
  
  const numKcs = 16;
  const numRuns = 1000;

  const aptitudeLevels: ('weak' | 'medium' | 'strong')[] = ['weak', 'medium', 'strong'];
  const results: PolicyResultsByAptitude = {};

  const policiesToTest = [
    { name: "Thompson", class: ThompsonSamplingPolicy },
    { name: "HDoC", class: HDoCPolicy },
    { name: "Random", class: RandomPolicy }
  ];

  for (const aptitude of aptitudeLevels) {
    results[aptitude] = {};
    console.log(`\nSimulating with Aptitude Level: ${aptitude}...`);

    for (const policyInfo of policiesToTest) {
      console.log(`Running ${policyInfo.name}...`);
      
      const currentConfig = { 
        ...baseConfig, 
        sampling_policy: policyInfo.name as 'Thompson' | 'HDoC' | 'Random' 
      };

      const simResults = await runPolicySimulation(
        policyInfo.class, 
        numKcs, 
        numRuns, 
        currentConfig,
        aptitude
      );
      
      results[aptitude][policyInfo.name] = simResults;

      console.log(`${policyInfo.name} Results for ${aptitude} aptitude:`);
      console.log(`Accuracy: ${simResults.accuracy.toFixed(3)}`);
      console.log(`Avg Questions: ${simResults.avg_questions.toFixed(1)}`);
      console.log(`F1 Score: ${simResults.f1_score.toFixed(3)}`);
      console.log(`Precision: ${simResults.precision.toFixed(3)}`);
      console.log("---");
    }
  }
  
  // Save results to JSON file
  const resultsFileName = 'simulation_results_ts_aptitude.json';
  fs.writeFileSync(resultsFileName, JSON.stringify(results, null, 2));
  console.log(`\nSimulation results saved to ${resultsFileName}`);
}

// Run the simulation
main().catch(console.error); 