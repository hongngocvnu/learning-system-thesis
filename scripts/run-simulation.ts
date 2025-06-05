// export {};
// import { runAssessmentSimulation } from '../lib/simulation/index';
// import { SimulationConfig } from '../lib/simulation/types';

// const numStudents = 100;
// const sessionsPerStudent = 3;
// const samplingPolicies: string[] = ['Thompson', 'HDoC', 'Random'];
// // const masteryThreshold = 0.6;

// async function main() {
//   for (let kcCount = 2; kcCount <= 16; kcCount++) {
//     const config: SimulationConfig = {
//       numStudents,
//       numTopics: kcCount, // KC count varies from 2 to 16
//       questionsPerTopic: 20, // giữ nguyên nếu cần, hoặc có thể bỏ nếu không dùng
//       sessionsPerStudent,
//       samplingPolicies,
//       // masteryThreshold, // loại bỏ nếu không có trong SimulationConfig
//     };
//     console.log(`Starting simulation with KC count = ${kcCount}...`);
//     console.log('Configuration:', config);
//     try {
//       const results = await runAssessmentSimulation(config);
//       console.log(`\nSimulation completed successfully for KC count = ${kcCount}!`);
//       // Lưu kết quả vào file
//       const fs = require('fs');
//       const path = require('path');
//       const outputDir = path.join(__dirname, '../simulation-results');
//       if (!fs.existsSync(outputDir)) {
//         fs.mkdirSync(outputDir);
//       }
//       const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//       const outputFile = path.join(outputDir, `simulation-results-KC-${kcCount}-${timestamp}.json`);
//       fs.writeFileSync(
//         outputFile,
//         JSON.stringify(results, null, 2)
//       );
//       console.log(`Results saved to: ${outputFile}`);
//     } catch (error) {
//       console.error('Error running simulation:', error);
//     }
//   }
// }

// main(); 