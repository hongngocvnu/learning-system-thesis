import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end();
    const { weakLOName, prerequisiteLOsFormatted, dependentLOsFormatted, courseName, masteryThreshold } = req.body;

    const feedback = `Your current weak area is ${weakLOName}.
    
    ${weakLOName} is a core concept in ${courseName}, important for understanding related topics and progressing in the course.
    
    To improve and reach the goal of ${masteryThreshold}% mastery, please focus on the following steps:
    
    1. Review prerequisites (these should be learned first):
        ${prerequisiteLOsFormatted !== 'None' ? prerequisiteLOsFormatted : 'No prerequisites.'}
    2. Master ${weakLOName}:
        - Carefully read the definition and key rules.
        - Practice with exercises and find relevant examples.
    3. Related learning objectives (these require you to master ${weakLOName}):
        ${dependentLOsFormatted !== 'None' ? `${dependentLOsFormatted}` : 'No dependent learning objectives.'}
    
    Keep practicing to strengthen your understanding!`;
    
    
    // Gửi feedback về frontend (ví dụ ExpressJS)
    res.json({ feedback });
} 