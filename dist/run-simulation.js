import { HDoCPolicy, ThompsonSamplingPolicy, RandomPolicy } from './adaptive-assessment';
import { createRandomDag, generateStudentMasteryAndParams, simulateAnswer } from './simulation-helpers';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
class StudentStateImpl {
    constructor() {
        this.totalQuestions = 0;
        this.answeredQuestions = new Set();
        this.sessionId = Date.now();
        this.topicMastery = new Map();
        this.topicCounts = new Map();
    }
}
// --- Helper Functions ---
function createTopicsForRun(numKcs, graph, masteryGroundTruth, config) {
    const topics = [];
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
async function runPolicySimulation(PolicyClass, numKcs, numRuns, config) {
    let correctIdentificationsTotal = 0;
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    const totalQuestionsAskedAcrossRuns = [];
    for (let i = 0; i < numRuns; i++) {
        // 1. Initialize for this run
        const graph = createRandomDag(numKcs);
        const { mastery: masteryGroundTruth } = await generateStudentMasteryAndParams(graph, 0.8, 0.2, config.masteryThreshold);
        const topicsForRun = createTopicsForRun(numKcs, graph, masteryGroundTruth, config);
        const weakGroundTruthIds = new Set();
        for (const topic of topicsForRun) {
            if (topic.true_mastery < config.masteryThreshold) {
                weakGroundTruthIds.add(topic.id);
            }
        }
        const studentState = new StudentStateImpl();
        let policy;
        if (PolicyClass.name === "HDoCPolicy") {
            policy = new HDoCPolicy();
            policy.reset(topicsForRun);
        }
        else if (PolicyClass.name === "ThompsonSamplingPolicy") {
            policy = new ThompsonSamplingPolicy();
        }
        else {
            policy = new RandomPolicy();
        }
        policy.initialize(topicsForRun);
        // 2. Pre-sample phase
        for (const topic of topicsForRun) {
            for (let k = 0; k < config.preSampleCount; k++) {
                if (studentState.totalQuestions >= config.maxQuestions)
                    break;
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
                const currentMasteryState = studentState.topicMastery.get(topic.id);
                if (answer) {
                    currentMasteryState.alpha += 1;
                }
                else {
                    currentMasteryState.beta += 1;
                }
                studentState.totalQuestions += 1;
                studentState.answeredQuestions.add(studentState.totalQuestions);
                studentState.topicCounts.set(topic.id, (studentState.topicCounts.get(topic.id) || 0) + 1);
            }
            if (studentState.totalQuestions >= config.maxQuestions)
                break;
        }
        if (studentState.totalQuestions >= config.maxQuestions) {
            if (weakGroundTruthIds.size === 0) {
                correctIdentificationsTotal += 1;
            }
            totalQuestionsAskedAcrossRuns.push(studentState.totalQuestions);
            continue;
        }
        // 3. Adaptive phase
        let predictedWeakestIdThisRun = null;
        while (studentState.totalQuestions < config.maxQuestions && policy.A.size > 0) {
            const selectedTopicId = policy.selectTopic(topicsForRun, studentState);
            if (selectedTopicId === -1)
                break;
            const selectedTopic = topicsForRun.find(t => t.id === selectedTopicId);
            const answer = simulateAnswer(selectedTopic.true_mastery);
            const currentMasteryState = studentState.topicMastery.get(selectedTopic.id);
            if (answer) {
                currentMasteryState.alpha += 1;
            }
            else {
                currentMasteryState.beta += 1;
            }
            studentState.totalQuestions += 1;
            studentState.answeredQuestions.add(studentState.totalQuestions);
            studentState.topicCounts.set(selectedTopic.id, (studentState.topicCounts.get(selectedTopic.id) || 0) + 1);
            const N_i_t_for_selected_topic = currentMasteryState.alpha + currentMasteryState.beta - 2;
            const resultAfterAnswer = policy.updateAfterAnswer(selectedTopic.id, currentMasteryState.alpha, currentMasteryState.beta, config.masteryThreshold, config.confidenceThreshold, topicsForRun.length, N_i_t_for_selected_topic);
            if (resultAfterAnswer === 'weak') {
                predictedWeakestIdThisRun = selectedTopic.id;
                break;
            }
        }
        // 4. Calculate metrics for this run
        let foundWeakCorrectly = false;
        if (predictedWeakestIdThisRun !== null && weakGroundTruthIds.has(predictedWeakestIdThisRun)) {
            foundWeakCorrectly = true;
            truePositives++;
        }
        else if (predictedWeakestIdThisRun !== null && !weakGroundTruthIds.has(predictedWeakestIdThisRun)) {
            falsePositives++;
        }
        else if (predictedWeakestIdThisRun === null && weakGroundTruthIds.size > 0) {
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
    const f1_score = 2 * (precision * recall) / (precision + recall) || 0;
    return {
        accuracy: finalAccuracy,
        avg_questions: averageQuestions,
        f1_score: f1_score,
        precision: precision
    };
}
// --- Main Function ---
async function main() {
    const config = {
        masteryThreshold: 0.7,
        confidenceThreshold: 0.15,
        preSampleCount: 1,
        maxQuestions: 80,
        sampling_policy: 'Thompson'
    };
    const kcCounts = Array.from({ length: 15 }, (_, i) => i + 2); // From 2 to 16 KCs
    const numRuns = 1000; // Reduced for faster testing, increase to 3000 for final results
    const results = {
        'Thompson': { accuracy: [], avg_questions: [], f1_score: [], precision: [] },
        'HDoC': { accuracy: [], avg_questions: [], f1_score: [], precision: [] },
        'Random': { accuracy: [], avg_questions: [], f1_score: [], precision: [] }
    };
    const policiesToTest = [
        { name: "Thompson", class: ThompsonSamplingPolicy },
        { name: "HDoC", class: HDoCPolicy },
        { name: "Random", class: RandomPolicy }
    ];
    for (const numKcs of kcCounts) {
        console.log(`\nSimulating with ${numKcs} KCs...`);
        for (const policyInfo of policiesToTest) {
            console.log(`Running ${policyInfo.name}...`);
            const simResults = await runPolicySimulation(policyInfo.class, numKcs, numRuns, config);
            results[policyInfo.name].accuracy.push(simResults.accuracy);
            results[policyInfo.name].avg_questions.push(simResults.avg_questions);
            results[policyInfo.name].f1_score.push(simResults.f1_score);
            results[policyInfo.name].precision.push(simResults.precision);
            console.log(`${policyInfo.name} Results:`);
            console.log(`Accuracy: ${simResults.accuracy.toFixed(3)}`);
            console.log(`Avg Questions: ${simResults.avg_questions.toFixed(1)}`);
            console.log(`F1 Score: ${simResults.f1_score.toFixed(3)}`);
            console.log(`Precision: ${simResults.precision.toFixed(3)}`);
            console.log("---");
        }
    }
    // Save results to JSON file
    fs.writeFileSync('simulation_results_ts.json', JSON.stringify(results, null, 2));
    console.log("\nSimulation results saved to simulation_results_ts.json");
    // Call Python script to visualize results
    const { spawn } = await import('child_process');
    const pythonProcess = spawn('python', ['lib/visualize_results.py']);
    pythonProcess.stdout.on('data', (data) => {
        console.log('Python output:', data.toString());
    });
    pythonProcess.stderr.on('data', (data) => {
        console.error('Python error:', data.toString());
    });
    pythonProcess.on('close', (code) => {
        if (code === 0) {
            console.log('\nVisualization completed. Results saved to simulation-ts-kc-2.png');
        }
        else {
            console.error(`\nPython process exited with code ${code}`);
        }
    });
}
// Run the simulation
main().catch(console.error);
