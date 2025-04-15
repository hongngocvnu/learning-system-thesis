import { NextApiRequest, NextApiResponse } from 'next'
import Together from 'together-ai'

const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { course, chapter, learningObjective } = req.body

    if (!process.env.TOGETHER_API_KEY) {
      console.error('TOGETHER_API_KEY is not set')
      return res.status(500).json({ error: 'API key is not configured' })
    }

    if (!course || !chapter || !learningObjective) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const prompt = `
Create 1 multiple choice question for the following context:

Course: "${course}"
Chapter: "${chapter}"
Learning Objective: "${learningObjective}"

IMPORTANT: You must respond with ONLY a valid JSON object. Do not include any additional text, explanations, or markdown formatting.

The JSON object must have exactly these fields:
{
  "question": "Your question text here",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": "The correct option text",
  "explanation": "Explain why the correct answer is correct",
  "difficulty": "easy", // or "medium", or "hard"
  "related_learning_objectives": [
    "${learningObjective}"
  ]
}

Constraints:
- The question must be related specifically to the learning objective.
- Only one correct option.
- The other three should be plausible but incorrect.
- The question should match the academic level of an introductory CS course.
- Your response must be ONLY the JSON object, with no additional text.
- The answer must be the exact text of one of the options, not just a letter.
`

    let fullResponse = ''
    try {
      const stream = await together.chat.completions.create({
        model: 'mistralai/Mixtral-8x7B-v0.1',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant that creates educational questions. You must always respond with ONLY a valid JSON object.'
          },
          { role: 'user', content: prompt }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 1000
      })

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        fullResponse += content
        console.log('Chunk received:', content)
      }

      console.log('Full response:', fullResponse)

      // Check if response is HTML error page
      if (fullResponse.includes('<!DOCTYPE') || fullResponse.includes('<html')) {
        console.error('Received HTML error page instead of JSON:', fullResponse)
        return res.status(500).json({ 
          error: 'API returned an error page. Please check your API key and configuration.' 
        })
      }

      const jsonMatch = fullResponse.match(/\{[\s\S]*?\}/)
      if (!jsonMatch) {
        console.error('No JSON found in response:', fullResponse)
        return res.status(500).json({ error: 'Invalid response format from the API' })
      }

      const data = JSON.parse(jsonMatch[0])

      if (
        !data.question ||
        !Array.isArray(data.options) ||
        data.options.length < 2 ||
        !data.answer ||
        !data.options.includes(data.answer)
      ) {
        return res.status(500).json({ error: 'Invalid question structure or answer mismatch' })
      }

      const difficultyMap: { [key: string]: string } = {
        easy: '1',
        medium: '2',
        hard: '3'
      }

      const mappedData = {
        ...data,
        difficulty: difficultyMap[data.difficulty.toLowerCase()] || '1',
        options: JSON.stringify(data.options) // for JSONB
      }

      return res.status(200).json(mappedData)
    } catch (error: any) {
      console.error('Together.ai API error:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      })
      return res.status(500).json({ 
        error: 'Failed to generate question. Please check your API key and configuration.' 
      })
    }
  } catch (error: any) {
    console.error('Error in auto-generate-question:', error)
    return res.status(500).json({ error: 'An unexpected error occurred' })
  }
} 