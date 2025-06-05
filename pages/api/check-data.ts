import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { courseId } = req.query

  if (!courseId) {
    return res.status(400).json({ error: 'Course ID is required' })
  }

  try {
    // 1. Check if course exists
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single()

    if (courseError || !course) {
      return res.status(404).json({ error: 'Course not found' })
    }

    // 2. Get chapters
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('*')
      .eq('course_id', courseId)
      .order('order_num', { ascending: true })

    if (chaptersError) {
      return res.status(500).json({ error: 'Error fetching chapters' })
    }

    if (!chapters || chapters.length === 0) {
      return res.status(404).json({ error: 'No chapters found for this course' })
    }

    // 3. Get learning objectives
    const { data: learningObjectives, error: losError } = await supabase
      .from('learning_objectives')
      .select('*')
      .in('chapter_id', chapters.map(c => c.id))

    if (losError) {
      return res.status(500).json({ error: 'Error fetching learning objectives' })
    }

    if (!learningObjectives || learningObjectives.length === 0) {
      return res.status(404).json({ error: 'No learning objectives found for this course' })
    }

    // 4. Get question mappings
    const { data: questionMappings, error: mappingsError } = await supabase
      .from('question_lo')
      .select('*')
      .in('lo_id', learningObjectives.map(lo => lo.id))

    if (mappingsError) {
      return res.status(500).json({ error: 'Error fetching question mappings' })
    }

    // 5. Get questions
    const questionIds = questionMappings?.map(qm => qm.question_id) || []
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .in('id', questionIds)

    if (questionsError) {
      return res.status(500).json({ error: 'Error fetching questions' })
    }

    // 6. Get choices
    const { data: choices, error: choicesError } = await supabase
      .from('choices')
      .select('*')
      .in('question_id', questionIds)

    if (choicesError) {
      return res.status(500).json({ error: 'Error fetching choices' })
    }

    // Analyze the data
    const losWithQuestions = learningObjectives.filter(lo => 
      questionMappings?.some(qm => qm.lo_id === lo.id)
    )

    const questionsWithChoices = questions?.filter(q => 
      choices?.some(c => c.question_id === q.id)
    ) || []

    const questionsWithCorrectChoice = questionsWithChoices.filter(q => 
      choices?.some(c => c.question_id === q.id && c.is_correct)
    )

    // Group questions by learning objective
    const questionsPerLO = learningObjectives.map(lo => {
      const loQuestions = questionMappings
        ?.filter(qm => qm.lo_id === lo.id)
        .map(qm => questions?.find(q => q.id === qm.question_id))
        .filter(Boolean)
      
      return {
        lo_id: lo.id,
        lo_title: lo.title,
        question_count: loQuestions?.length || 0,
        has_choices: loQuestions?.every(q => 
          choices?.some(c => c.question_id === q?.id)
        ) || false,
        has_correct_choice: loQuestions?.every(q => 
          choices?.some(c => c.question_id === q?.id && c.is_correct)
        ) || false
      }
    })

    return res.status(200).json({
      course: {
        id: course.id,
        name: course.name,
        code: course.code
      },
      summary: {
        chapters: chapters.length,
        learning_objectives: learningObjectives.length,
        learning_objectives_with_questions: losWithQuestions.length,
        questions: questions?.length || 0,
        questions_with_choices: questionsWithChoices.length,
        questions_with_correct_choice: questionsWithCorrectChoice.length
      },
      details: {
        questions_per_lo: questionsPerLO
      }
    })

  } catch (error) {
    console.error('Error checking data:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
} 