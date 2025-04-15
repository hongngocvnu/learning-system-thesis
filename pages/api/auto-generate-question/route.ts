// POST /api/auto-generate-question
import { NextResponse } from 'next/server'
import Together from 'together-ai'

const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { course, chapter, learningObjective } = body

    // Validate API key
    if (!process.env.TOGETHER_API_KEY) {
      console.error('TOGETHER_API_KEY is not set')
      return NextResponse.json(
        { error: 'API key is not configured. Please check your environment variables.' },
        { status: 500 }
      )
    }

    // Validate required fields
    if (!course || !chapter || !learningObjective) {
      return NextResponse.json(
        { error: 'Missing required fields: course, chapter, or learning objective' },
        { status: 400 }
      )
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
  "choices": [
    {
      "choice": "Option A text",
      "is_correct": true
    },
    {
      "choice": "Option B text",
      "is_correct": false
    },
    {
      "choice": "Option C text",
      "is_correct": false
    },
    {
      "choice": "Option D text",
      "is_correct": false
    }
  ],
  "explanation": "Explain why the correct answer is correct",
  "difficulty": "easy" // or "medium", or "hard"
}

Constraints:
- The question must be related specifically to the learning objective.
- Only one choice should have "is_correct": true.
- The other three choices should be plausible but incorrect.
- The question should match the academic level of an introductory CS course.
- Your response must be ONLY the JSON object, with no additional text.
- Each choice must be a complete, grammatically correct statement.
- The choices should be clearly distinct from each other.
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
        return NextResponse.json(
          { error: 'API returned an error page. Please check your API key and configuration.' },
          { status: 500 }
        )
      }

      // Try to parse the response as JSON
      let data
      try {
        const jsonMatch = fullResponse.match(/\{[\s\S]*?\}/)
        if (!jsonMatch) {
          throw new Error('No JSON found in response')
        }
        data = JSON.parse(jsonMatch[0])
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError)
        return NextResponse.json(
          { error: 'Invalid response format from the API. Please try again.' },
          { status: 500 }
        )
      }

      // Validate the question structure
      if (
        !data.question ||
        !Array.isArray(data.choices) ||
        data.choices.length < 2 ||
        !data.choices.some((c: any) => c.is_correct) ||
        data.choices.filter((c: any) => c.is_correct).length !== 1
      ) {
        return NextResponse.json(
          { error: 'Invalid question structure. Must have exactly one correct choice.' },
          { status: 500 }
        )
      }

      const difficultyMap: { [key: string]: string } = {
        easy: '1',
        medium: '2',
        hard: '3'
      }

      const mappedData = {
        question: data.question,
        choices: data.choices,
        explanation: data.explanation,
        difficulty: difficultyMap[data.difficulty.toLowerCase()] || '1'
      }

      return NextResponse.json(mappedData)
    } catch (error: any) {
      console.error('Together.ai API error:', error)
      // Log the full error details
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers
      })

      // Check for specific error types
      if (error.message.includes('401')) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your Together.ai API key configuration.' },
          { status: 500 }
        )
      } else if (error.message.includes('429')) {
        return NextResponse.json(
          { error: 'API rate limit exceeded. Please try again later.' },
          { status: 500 }
        )
      } else if (error.message.includes('500')) {
        return NextResponse.json(
          { error: 'API service is currently unavailable. Please try again later.' },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to generate question. Please check your API key and configuration.' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error in auto-generate-question:', error)
    return NextResponse.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
