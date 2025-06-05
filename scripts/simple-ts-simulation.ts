  // import * as fs from 'fs';
  // import { fileURLToPath } from 'url';
  // import path, { dirname } from 'path';
  // import { HDoCPolicy, ThompsonSamplingPolicy } from '../lib/adaptive-assessment.ts';

  // const __filename = fileURLToPath(import.meta.url);
  // const __dirname = dirname(__filename);

  // const numStudents = 500;
  // const sessionsPerStudent = 3;
  // const masteryThreshold = 0.6;
  // const minQuestionsPerTopic = 3; // số câu hỏi tối thiểu cho mỗi LO
  // const confidenceThreshold = 0.8; // ngưỡng tin cậy
  // const kcCounts = Array.from({ length: 15 }, (_, i) => i + 2); // KC từ 2 đến 16
  // const policies = [
  //   { name: 'HDoC' },
  //   { name: 'Thompson' }
  // ];

  // interface Result {
  //   kcCount: number;
  //   policy: string;
  //   avgQuestions: number;
  //   accuracy: number;
  // }

  // function randomBeta(alpha: number, beta: number): number {
  //   const u1 = Math.random();
  //   const u2 = Math.random();
  //   return Math.pow(u1, 1 / alpha) / (Math.pow(u1, 1 / alpha) + Math.pow(u2, 1 / beta));
  // }

  // function calculateConfidence(alpha: number, beta: number): number {
  //   const total = alpha + beta;
  //   if (total === 0) return 0;
  //   const variance = (alpha * beta) / (Math.pow(total, 2) * (total + 1));
  //   return 1 - Math.sqrt(variance);
  // }

  // function selectLO(policy: string, a: number[], b: number[], masteryProbs: number[], threshold: number, topicCounts: number[], totalQuestions: number): number {
  //   if (policy === 'Thompson') {
  //     const samples = a.map((ai, i) => randomBeta(ai + 1, b[i] + 1));
  //     return samples.indexOf(Math.min(...samples));
  //   } else if (policy === 'HDoC') {
  //     let minScore = Infinity;
  //     let selectedIdx = 0;
  //     for (let i = 0; i < a.length; i++) {
  //       const mastery = a[i] / (a[i] + b[i]);
  //       const Nt = topicCounts[i] || 1;
  //       const score = mastery - Math.sqrt(2 * Math.log(totalQuestions + 1) / Nt);
  //       if (score < minScore) {
  //         minScore = score;
  //         selectedIdx = i;
  //       }
  //     }
  //     return selectedIdx;
  //   }
  //   return 0;
  // }

  // async function simulate() {
  //   const results: Result[] = [];
  //   const hdocPolicy = new HDoCPolicy();
  //   const thompsonPolicy = new ThompsonSamplingPolicy();
    
  //   for (const kcCount of kcCounts) {
  //     console.log(`\nSimulating for KC count: ${kcCount}`);
  //     for (const { name: policy } of policies) {
  //       let totalQuestions = 0;
  //       let correctCount = 0;
        
  //       for (let student = 0; student < numStudents; student++) {
  //         const groundTruth = Math.floor(Math.random() * kcCount);
  //         let a = Array(kcCount).fill(1);
  //         let b = Array(kcCount).fill(1);
  //         let topicCounts = Array(kcCount).fill(0);
  //         let found = false;
  //         let questions = 0;
          
  //         for (let session = 0; session < sessionsPerStudent && !found; session++) {
  //           let sessionQuestions = 0;
  //           while (!found && sessionQuestions < 100) {
  //             const masteryProbs = a.map((ai, i) => ai / (ai + b[i]));
  //             const confidences = a.map((ai, i) => calculateConfidence(ai, b[i]));
  //             // --- Tiêu chí dừng 1: LO yếu, đủ tin cậy, đủ số câu hỏi tối thiểu ---
  //             let stopByWeakLO = false;
  //             for (let i = 0; i < kcCount; i++) {
  //               if (
  //                 topicCounts[i] >= minQuestionsPerTopic &&
  //                 masteryProbs[i] < masteryThreshold &&
  //                 confidences[i] >= confidenceThreshold
  //               ) {
  //                 stopByWeakLO = true;
  //                 break;
  //               }
  //             }
  //             if (stopByWeakLO) {
  //               found = true;
  //               break;
  //             }
  //             // ---
  //             const loIdx = selectLO(policy, a, b, masteryProbs, masteryThreshold, topicCounts, questions);
  //             const correct = loIdx === groundTruth ?
  //               Math.random() < 0.2 : // LO yếu chỉ đúng 20%
  //               Math.random() < 0.9;  // LO khác đúng 90%
  //             if (correct) a[loIdx] += 1; else b[loIdx] += 1;
  //             topicCounts[loIdx]++;
  //             questions++;
  //             sessionQuestions++;
  //           }
  //         }
          
  //         totalQuestions += questions;
  //         const masteryProbs = a.map((ai, i) => ai / (ai + b[i]));
  //         const predictedWeak = masteryProbs.indexOf(Math.min(...masteryProbs));
  //         if (predictedWeak === groundTruth) correctCount++;
  //       }
        
  //       const result = {
  //         kcCount,
  //         policy,
  //         avgQuestions: totalQuestions / numStudents,
  //         accuracy: correctCount / numStudents
  //       };
  //       results.push(result);
  //       console.log(`KC: ${kcCount}, Policy: ${policy}, AvgQ: ${result.avgQuestions.toFixed(2)}, Acc: ${result.accuracy.toFixed(3)}`);
  //     }
  //   }
    
  //   // Lưu kết quả
  //   const outputDir = path.join(__dirname, '../simulation-results');
  //   if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  //   const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  //   const outputFile = path.join(outputDir, `simple-ts-simulation-KC-sweep-${timestamp}.json`);
  //   fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  //   console.log('\nSaved results to:', outputFile);
  // }

  // simulate(); 