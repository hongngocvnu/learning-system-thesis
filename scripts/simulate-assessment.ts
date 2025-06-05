// import { AdaptiveAssessmentSystem } from '../lib/adaptive-assessment.ts';
// import type { Topic, Question } from '../lib/adaptive-assessment.ts';
// import * as fs from 'fs';
// import * as path from 'path';
// import { createClient } from '@supabase/supabase-js';

// interface SimulationConfig {
//   numStudents: number;
//   masteryThreshold: number; // ξ = 0.7
//   confidenceThreshold: number;
//   maxQuestions: number;
//   questionsPerKC: number;
//   algorithm: 'HDoC' | 'Thompson Sampling' | 'Random';
//   numKCs: number; // Số lượng KCs (2-16)
//   errorRate: number; // δ = 0.15
//   aptitude: number; // apt(s) trong khoảng [0.1, 1]
//   w1: number; // Trọng số cho aptitude
//   w2: number; // Trọng số cho prerequisites
// }

// interface SimulationResult {
//   studentId: number;
//   totalQuestions: number;
//   weakTopics: number;
//   averageMastery: number;
//   confidence: number;
//   timeToDetectWeak: number;
//   falsePositives: number;
//   falseNegatives: number;
//   accuracy: number;
//   detectedWeakKCs: number[];
//   actualWeakKCs: number[];
// }

// class AssessmentSimulator {
//   private config: SimulationConfig;
//   private results: SimulationResult[] = [];

//   constructor(config: SimulationConfig) {
//     this.config = config;
//   }

//   // Tạo DAG ngẫu nhiên cho các KC
//   private generateDAG(numKCs: number): Map<number, number[]> {
//     const prerequisites = new Map<number, number[]>();
//     const maxEdges = numKCs * (numKCs - 1);
//     const numEdges = Math.floor(Math.random() * (maxEdges - 2 + 1)) + 2;

//     // Khởi tạo các node
//     for (let i = 0; i < numKCs; i++) {
//       prerequisites.set(i + 1, []);
//     }

//     // Thêm các cạnh ngẫu nhiên
//     let edgesAdded = 0;
//     while (edgesAdded < numEdges) {
//       const from = Math.floor(Math.random() * numKCs) + 1;
//       const to = Math.floor(Math.random() * numKCs) + 1;
      
//       // Kiểm tra không tạo cycle
//       if (from < to && !prerequisites.get(to)?.includes(from)) {
//         prerequisites.get(to)?.push(from);
//         edgesAdded++;
//       }
//     }

//     return prerequisites;
//   }

//   // Tính toán ground truth mastery cho một KC
//   private calculateGroundTruthMastery(
//     aptitude: number,
//     prerequisites: number[],
//     prerequisiteMastery: Map<number, number>
//   ): number {
//     const w1 = this.config.w1;
//     const w2 = this.config.w2;

//     // Tính tỷ lệ prerequisites đã master
//     let masteredPrereqs = 0;
//     for (const prereqId of prerequisites) {
//       const prereqMastery = prerequisiteMastery.get(prereqId) || 0;
//       if (prereqMastery >= this.config.masteryThreshold) {
//         masteredPrereqs++;
//       }
//     }
//     const preRatio = prerequisites.length > 0 ? masteredPrereqs / prerequisites.length : 1;

//     // Tính mastery theo công thức μKC(s) = w1 × apt(s) + w2 × pre(KC)
//     return w1 * aptitude + w2 * preRatio;
//   }

//   // Tạo dữ liệu giả cho một học sinh
//   private generateStudentData(): {
//     topics: Topic[];
//     questions: Question[];
//     groundTruthMastery: Map<number, number>;
//     actualWeakKCs: number[];
//   } {
//     const topics: Topic[] = [];
//     const questions: Question[] = [];
//     const groundTruthMastery = new Map<number, number>();
//     const actualWeakKCs: number[] = [];

//     // Tạo DAG cho các KC
//     const prerequisites = this.generateDAG(this.config.numKCs);

//     // Tạo các KC và câu hỏi
//     for (let i = 0; i < this.config.numKCs; i++) {
//       const topicId = i + 1;
//       const topicPrerequisites = prerequisites.get(topicId) || [];

//       // Tính ground truth mastery
//       const mastery = this.calculateGroundTruthMastery(
//         this.config.aptitude,
//         topicPrerequisites,
//         groundTruthMastery
//       );
//       groundTruthMastery.set(topicId, mastery);

//       // Nếu mastery < threshold, thêm vào danh sách weak KCs
//       if (mastery < this.config.masteryThreshold) {
//         actualWeakKCs.push(topicId);
//       }

//       // Tạo topic
//       const topic: Topic = {
//         id: topicId,
//         name: `Topic ${topicId}`,
//         description: `Description for topic ${topicId}`,
//         lo_code: `LO${topicId}`,
//         mastery_threshold: this.config.masteryThreshold,
//         confidence_delta: 0.05,
//         min_samples: 3,
//         difficulty: 0.1 + (i * 0.1),
//         concept_weight: 1.0,
//         time_decay_factor: 0.1,
//         questions: [],
//         hasBeenAsked: false,
//         alpha: Math.floor(Math.random() * 301) + 200, // Random trong [200, 500]
//         beta: Math.round((Math.floor(Math.random() * 301) + 200) * (1 - mastery) / mastery),
//         prerequisites: topicPrerequisites,
//         level: Math.floor(i / 4)
//       };

//       // Tạo câu hỏi cho topic
//       for (let j = 0; j < this.config.questionsPerKC; j++) {
//         const question: Question = {
//           id: (i * this.config.questionsPerKC) + j + 1,
//           question_rich_text: `Question ${j + 1} for Topic ${topicId}`,
//           explanation: `Explanation for question ${j + 1}`,
//           difficulty: 0.1 + (j * 0.1),
//           concept_weight: 1.0,
//           time_decay_factor: 0.1,
//           choices: [
//             { id: 1, question_id: (i * this.config.questionsPerKC) + j + 1, choice: 'A', is_correct: true },
//             { id: 2, question_id: (i * this.config.questionsPerKC) + j + 1, choice: 'B', is_correct: false },
//             { id: 3, question_id: (i * this.config.questionsPerKC) + j + 1, choice: 'C', is_correct: false },
//             { id: 4, question_id: (i * this.config.questionsPerKC) + j + 1, choice: 'D', is_correct: false }
//           ],
//           correctOption: 0,
//           topic_id: topicId
//         };
//         questions.push(question);
//         topic.questions.push(question);
//       }
//       topics.push(topic);
//     }

//     return { topics, questions, groundTruthMastery, actualWeakKCs };
//   }

//   // Mô phỏng một học sinh
//   private async simulateStudent(studentId: number): Promise<SimulationResult> {
//     const { topics, questions, groundTruthMastery, actualWeakKCs } = this.generateStudentData();
    
//     // Khởi tạo assessment system
//     const assessment = new AdaptiveAssessmentSystem(
//       topics,
//       questions,
//       studentId.toString(),
//       null, // Không cần supabase cho mô phỏng
//       'simulation-course',
//       {
//         maxQuestions: this.config.maxQuestions,
//         maxQuestionsPerTopic: this.config.questionsPerKC,
//         explorationFactor: 0.5,
//         minQuestionsForConfidence: 3,
//         masteryThreshold: this.config.masteryThreshold,
//         confidenceThreshold: this.config.confidenceThreshold
//       }
//     );

//     // Set sampling policy
//     assessment.setSamplingPolicy(this.config.algorithm);

//     let totalQuestions = 0;
//     let weakTopics = 0;
//     let timeToDetectWeak = 0;
//     let falsePositives = 0;
//     let falseNegatives = 0;
//     const detectedWeakKCs: number[] = [];

//     // Mô phỏng quá trình trả lời câu hỏi
//     while (totalQuestions < this.config.maxQuestions) {
//       const question = assessment.getNextQuestion();
//       if (!question) break;

//       // Xác suất trả lời đúng dựa trên ground truth mastery và guess factor
//       const topic = topics.find(t => t.id === question.topic_id);
//       if (!topic) continue;

//       const mastery = groundTruthMastery.get(topic.id) || 0;
//       const betaSample = this.sampleBeta(topic.alpha, topic.beta);
//       const guessFactor = 1 / 4; // 4 choices
//       const pCorrect = betaSample + (1 - betaSample) * guessFactor;
//       const isCorrect = Math.random() < pCorrect;

//       assessment.processAnswer(question.id, isCorrect);
//       totalQuestions++;

//       // Kiểm tra weak KC
//       const weakKC = assessment.getWeakKC();
//       if (weakKC) {
//         if (timeToDetectWeak === 0) {
//           timeToDetectWeak = totalQuestions;
//         }
//         weakTopics++;
//         detectedWeakKCs.push(weakKC.topicId);

//         // Kiểm tra false positive/negative
//         const groundTruthMasteryValue = groundTruthMastery.get(weakKC.topicId) || 0;
//         const topicMastery = assessment.studentState.topicMastery.get(weakKC.topicId);
        
//         if (topicMastery) {
//           if (topicMastery.mastery >= this.config.masteryThreshold && 
//               groundTruthMasteryValue < this.config.masteryThreshold) {
//             falsePositives++;
//           } else if (topicMastery.mastery < this.config.masteryThreshold && 
//                      groundTruthMasteryValue >= this.config.masteryThreshold) {
//             falseNegatives++;
//           }
//         }
//       }
//     }

//     // Tính toán kết quả
//     const masteryValues = Array.from(assessment.studentState.topicMastery.values());
//     const averageMastery = masteryValues.reduce((sum, state) => sum + state.mastery, 0) / masteryValues.length;
//     const averageConfidence = masteryValues.reduce((sum, state) => sum + state.confidence, 0) / masteryValues.length;

//     return {
//       studentId,
//       totalQuestions,
//       weakTopics,
//       averageMastery,
//       confidence: averageConfidence,
//       timeToDetectWeak,
//       falsePositives,
//       falseNegatives,
//       accuracy: ((totalQuestions - (falsePositives + falseNegatives)) / totalQuestions * 100),
//       detectedWeakKCs,
//       actualWeakKCs
//     };
//   }

//   // Lấy mẫu từ phân phối Beta
//   private sampleBeta(alpha: number, beta: number): number {
//     const x = this.sampleGamma(alpha, 1);
//     const y = this.sampleGamma(beta, 1);
//     return x / (x + y);
//   }

//   // Lấy mẫu từ phân phối Gamma
//   private sampleGamma(shape: number, scale: number): number {
//     if (shape < 1) {
//       return this.sampleGamma(1 + shape, scale) * Math.pow(Math.random(), 1 / shape);
//     }

//     const d = shape - 1/3;
//     const c = 1 / Math.sqrt(9 * d);

//     while (true) {
//       const x = this.sampleNormal();
//       const v = Math.pow(1 + c * x, 3);
      
//       if (Math.random() < 0.5 * x * x + d * (1 - v + Math.log(v))) {
//         return scale * d * v;
//       }
//     }
//   }

//   // Lấy mẫu từ phân phối chuẩn
//   private sampleNormal(): number {
//     let u = 0, v = 0;
//     while (u === 0) u = Math.random();
//     while (v === 0) v = Math.random();
//     return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
//   }

//   // Chạy mô phỏng
//   public async runSimulation(): Promise<void> {
//     console.log('Starting simulation...');
//     console.log('Config:', this.config);

//     for (let i = 0; i < this.config.numStudents; i++) {
//       console.log(`Simulating student ${i + 1}/${this.config.numStudents}`);
//       const result = await this.simulateStudent(i + 1);
//       this.results.push(result);
//     }

//     this.analyzeResults();
//   }

//   // Phân tích kết quả
//   private analyzeResults(): void {
//     const totalStudents = this.results.length;
    
//     const averageQuestions = this.results.reduce((sum, r) => sum + r.totalQuestions, 0) / totalStudents;
//     const averageWeakTopics = this.results.reduce((sum, r) => sum + r.weakTopics, 0) / totalStudents;
//     const averageMastery = this.results.reduce((sum, r) => sum + r.averageMastery, 0) / totalStudents;
//     const averageConfidence = this.results.reduce((sum, r) => sum + r.confidence, 0) / totalStudents;
//     const averageTimeToDetect = this.results.reduce((sum, r) => sum + r.timeToDetectWeak, 0) / totalStudents;
//     const totalFalsePositives = this.results.reduce((sum, r) => sum + r.falsePositives, 0);
//     const totalFalseNegatives = this.results.reduce((sum, r) => sum + r.falseNegatives, 0);
//     const averageAccuracy = this.results.reduce((sum, r) => sum + r.accuracy, 0) / totalStudents;

//     // Tính precision và recall
//     let totalPrecision = 0;
//     let totalRecall = 0;

//     this.results.forEach(result => {
//       const detectedSet = new Set(result.detectedWeakKCs);
//       const actualSet = new Set(result.actualWeakKCs);
      
//       // Precision = true positives / (true positives + false positives)
//       const truePositives = result.detectedWeakKCs.filter(kc => actualSet.has(kc)).length;
//       const precision = detectedSet.size > 0 ? truePositives / detectedSet.size : 0;
      
//       // Recall = true positives / (true positives + false negatives)
//       const recall = actualSet.size > 0 ? truePositives / actualSet.size : 0;
      
//       totalPrecision += precision;
//       totalRecall += recall;
//     });

//     const averagePrecision = totalPrecision / totalStudents;
//     const averageRecall = totalRecall / totalStudents;
//     const f1Score = 2 * (averagePrecision * averageRecall) / (averagePrecision + averageRecall);

//     const results = {
//       algorithm: this.config.algorithm,
//       numKCs: this.config.numKCs,
//       questionsPerKC: this.config.questionsPerKC,
//       totalStudents,
//       averageQuestions,
//       averageWeakTopics,
//       averageMastery,
//       averageConfidence,
//       averageTimeToDetect,
//       totalFalsePositives,
//       totalFalseNegatives,
//       averageAccuracy,
//       averagePrecision,
//       averageRecall,
//       f1Score
//     };

//     // Lưu kết quả vào file
//     const resultsDir = path.join(__dirname, 'simulation-results');
//     if (!fs.existsSync(resultsDir)) {
//       fs.mkdirSync(resultsDir);
//     }

//     const filename = path.join(resultsDir, `results_${this.config.algorithm}_${this.config.numKCs}_${this.config.questionsPerKC}.json`);
//     fs.writeFileSync(filename, JSON.stringify(results, null, 2));

//     console.log('\nSimulation Results:');
//     console.log('------------------');
//     console.log(`Algorithm: ${this.config.algorithm}`);
//     console.log(`Number of KCs: ${this.config.numKCs}`);
//     console.log(`Questions per KC: ${this.config.questionsPerKC}`);
//     console.log(`Total Students: ${totalStudents}`);
//     console.log(`Average Questions per Student: ${averageQuestions.toFixed(2)}`);
//     console.log(`Average Weak Topics Detected: ${averageWeakTopics.toFixed(2)}`);
//     console.log(`Average Mastery: ${(averageMastery * 100).toFixed(2)}%`);
//     console.log(`Average Confidence: ${(averageConfidence * 100).toFixed(2)}%`);
//     console.log(`Average Time to Detect Weak Topics: ${averageTimeToDetect.toFixed(2)} questions`);
//     console.log(`False Positives: ${totalFalsePositives}`);
//     console.log(`False Negatives: ${totalFalseNegatives}`);
//     console.log(`Average Accuracy: ${averageAccuracy.toFixed(2)}%`);
//     console.log(`Average Precision: ${(averagePrecision * 100).toFixed(2)}%`);
//     console.log(`Average Recall: ${(averageRecall * 100).toFixed(2)}%`);
//     console.log(`F1 Score: ${(f1Score * 100).toFixed(2)}%`);
//   }
// }

// // Chạy mô phỏng cho tất cả các thuật toán và số lượng KCs
// async function runAllSimulations() {
//   const algorithms: ('HDoC' | 'Thompson Sampling' | 'Random')[] = ['HDoC', 'Thompson Sampling', 'Random'];
//   const numKCs = [2, 4, 8, 16];
//   const questionsPerKC = [2, 4, 8, 16];

//   for (const algorithm of algorithms) {
//     for (const kcs of numKCs) {
//       for (const qPerKC of questionsPerKC) {
//         console.log(`\nRunning simulation for ${algorithm} with ${kcs} KCs and ${qPerKC} questions per KC`);
//         const simulator = new AssessmentSimulator({
//           numStudents: 100,
//           masteryThreshold: 0.7, // ξ = 0.7
//           confidenceThreshold: 0.95,
//           maxQuestions: 50,
//           questionsPerKC: qPerKC,
//           algorithm,
//           numKCs: kcs,
//           errorRate: 0.15, // δ = 0.15
//           aptitude: Math.random() * 0.9 + 0.1, // Random trong [0.1, 1]
//           w1: 0.6, // Trọng số cho aptitude
//           w2: 0.4  // Trọng số cho prerequisites
//         });
//         await simulator.runSimulation();
//       }
//     }
//   }
// }

// // Mock data for simulation
// const mockTopics = [
//   {
//     id: 1,
//     name: "Topic 1 - Strong",
//     description: "Strong topic with high mastery",
//     lo_code: "LO1",
//     mastery_threshold: 0.6,
//     confidence_delta: 0.05,
//     min_samples: 5,
//     difficulty: 1.0,
//     concept_weight: 1.0,
//     time_decay_factor: 0.1,
//     questions: Array(10).fill(null).map((_, i) => ({
//       id: i + 1,
//       question_rich_text: `Question ${i + 1} for Topic 1`,
//       explanation: "Explanation",
//       difficulty: 1.0,
//       concept_weight: 1.0,
//       time_decay_factor: 0.1,
//       choices: [
//         { id: 1, question_id: i + 1, choice: "Correct", is_correct: true },
//         { id: 2, question_id: i + 1, choice: "Incorrect", is_correct: false }
//       ],
//       correctOption: 0,
//       topic_id: 1
//     })),
//     hasBeenAsked: false,
//     alpha: 1.0,
//     beta: 1.0,
//     prerequisites: [],
//     level: 1
//   },
//   {
//     id: 2,
//     name: "Topic 2 - Weak",
//     description: "Weak topic with low mastery",
//     lo_code: "LO2",
//     mastery_threshold: 0.6,
//     confidence_delta: 0.05,
//     min_samples: 5,
//     difficulty: 1.0,
//     concept_weight: 1.0,
//     time_decay_factor: 0.1,
//     questions: Array(10).fill(null).map((_, i) => ({
//       id: i + 11,
//       question_rich_text: `Question ${i + 1} for Topic 2`,
//       explanation: "Explanation",
//       difficulty: 1.0,
//       concept_weight: 1.0,
//       time_decay_factor: 0.1,
//       choices: [
//         { id: 1, question_id: i + 11, choice: "Correct", is_correct: true },
//         { id: 2, question_id: i + 11, choice: "Incorrect", is_correct: false }
//       ],
//       correctOption: 0,
//       topic_id: 2
//     })),
//     hasBeenAsked: false,
//     alpha: 1.0,
//     beta: 1.0,
//     prerequisites: [],
//     level: 1
//   }
// ];

// async function simulateAssessment() {
//   // Initialize assessment system with mock data
//   const assessment = new AdaptiveAssessmentSystem(
//     mockTopics,
//     mockTopics.flatMap(t => t.questions),
//     "test-user",
//     null, // No Supabase client needed for simulation
//     "test-course",
//     {
//       maxQuestions: 20,
//       maxQuestionsPerTopic: 10,
//       explorationFactor: 2.0,
//       minQuestionsForConfidence: 2,
//       masteryThreshold: 0.6,
//       confidenceThreshold: 0.95,
//       preSampleCount: 2,
//       maxPreSampleBudget: 0.4
//     }
//   );

//   console.log("Starting assessment simulation...");
//   console.log("Initial state:", {
//     topics: assessment.getTopics().map(t => ({
//       id: t.id,
//       name: t.name,
//       questionsCount: t.questions.length
//     }))
//   });

//   // Simulate answering questions
//   let questionCount = 0;
//   let weakKC = null;

//   while (questionCount < 20 && !weakKC) {
//     const question = assessment.getNextQuestion();
//     if (!question) {
//       console.log("No more questions available");
//       break;
//     }

//     // Simulate student performance
//     // For Topic 1 (Strong): 80% correct
//     // For Topic 2 (Weak): 30% correct
//     const isCorrect = question.topic_id === 1 
//       ? Math.random() < 0.8 
//       : Math.random() < 0.3;

//     console.log(`Question ${questionCount + 1}:`, {
//       topicId: question.topic_id,
//       topicName: mockTopics.find(t => t.id === question.topic_id)?.name,
//       isCorrect,
//       questionText: question.question_rich_text.substring(0, 50) + "..."
//     });

//     assessment.processAnswer(question.id, isCorrect);
//     questionCount++;

//     // Check for weak KC after each answer
//     weakKC = assessment.getWeakKC();
//     if (weakKC) {
//       console.log("Weak KC detected:", {
//         topicId: weakKC.topicId,
//         name: weakKC.name,
//         mastery: weakKC.mastery,
//         confidence: weakKC.confidence,
//         questionsAsked: weakKC.questionsAsked,
//         successRate: weakKC.successRate
//       });
//     }
//   }

//   // Get final assessment results
//   const results = await assessment.getAssessmentResults();
//   console.log("\nFinal Assessment Results:", {
//     totalQuestions: results.totalQuestions,
//     recommendedTopics: results.recommendedTopics.map(t => ({
//       id: t.id,
//       name: t.name,
//       mastery: t.mastery,
//       confidence: t.confidence,
//       questionsAsked: t.questionsAsked
//     }))
//   });
// }

// // Run simulation
// simulateAssessment().catch(console.error);

// runAllSimulations().catch(console.error); 