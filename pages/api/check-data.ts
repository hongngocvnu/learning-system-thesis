import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const courseId = req.query.courseId as string
    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' })
    }

    console.log('Checking data for course:', courseId)

    // Fetch course
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single()

    if (courseError) {
      console.error('Error fetching course:', courseError)
      return res.status(500).json({ error: courseError.message })
    }

    if (!course) {
      console.error('Course not found:', courseId)
      return res.status(404).json({ error: 'Course not found' })
    }

    console.log('Course found:', course)

    // Fetch chapters
    const { data: chapters, error: chaptersError } = await supabase
      .from('chapters')
      .select('*')
      .eq('course_id', courseId)
      .order('order_num', { ascending: true })

    if (chaptersError) {
      console.error('Error fetching chapters:', chaptersError)
      return res.status(500).json({ error: chaptersError.message })
    }

    if (!chapters || chapters.length === 0) {
      console.error('No chapters found for course:', courseId)
      return res.status(404).json({ error: 'No chapters found for this course' })
    }

    console.log('Chapters found:', chapters.length)
    console.log('Chapter IDs:', chapters.map(c => c.id))

    // Fetch learning objectives
    const { data: learningObjectives, error: losError } = await supabase
      .from('learning_objectives')
      .select('*')
      .in('chapter_id', chapters.map(c => c.id))

    if (losError) {
      console.error('Error fetching learning objectives:', losError)
      return res.status(500).json({ error: losError.message })
    }

    if (!learningObjectives || learningObjectives.length === 0) {
      console.error('No learning objectives found for chapters:', chapters.map(c => c.id))
      return res.status(404).json({ error: 'No learning objectives found for this course' })
    }

    console.log('Learning objectives found:', learningObjectives.length)
    console.log('Learning objective IDs:', learningObjectives.map(lo => lo.id))

    // Fetch question-LO mappings
    const { data: questionLOs, error: qlosError } = await supabase
      .from('question_lo')
      .select('*')
      .in('lo_id', learningObjectives.map(lo => lo.id))

    if (qlosError) {
      console.error('Error fetching question-LO mappings:', qlosError)
      return res.status(500).json({ error: qlosError.message })
    }

    if (!questionLOs || questionLOs.length === 0) {
      console.error('No question mappings found for LOs:', learningObjectives.map(lo => lo.id))
      return res.status(404).json({ error: 'No questions mapped to learning objectives' })
    }

    console.log('Question-LO mappings found:', questionLOs.length)
    console.log('Question-LO mapping details:', questionLOs)

    // Fetch questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .in('id', questionLOs.map(qlo => qlo.question_id))

    if (questionsError) {
      console.error('Error fetching questions:', questionsError)
      return res.status(500).json({ error: questionsError.message })
    }

    console.log('Question IDs from mappings:', questionLOs.map(qlo => qlo.question_id))
    console.log('Questions found:', questions?.length || 0)
    console.log('Questions data:', questions)

    if (!questions || questions.length === 0) {
      console.error('No questions found for IDs:', questionLOs.map(qlo => qlo.question_id))
      return res.status(404).json({ error: 'No questions found in the database' })
    }

    // Fetch choices
    const { data: choices, error: choicesError } = await supabase
      .from('choices')
      .select('*')
      .in('question_id', questions.map(q => q.id))

    if (choicesError) {
      console.error('Error fetching choices:', choicesError)
      return res.status(500).json({ error: choicesError.message })
    }

    console.log('Choices found:', choices?.length || 0)
    console.log('Choices data:', choices)

    if (!choices || choices.length === 0) {
      console.error('No choices found for questions:', questions.map(q => q.id))
      return res.status(404).json({ error: 'No choices found for questions' })
    }

    // Return data summary with more details
    return res.status(200).json({
      course,
      summary: {
        chaptersCount: chapters.length,
        learningObjectivesCount: learningObjectives.length,
        questionLOsCount: questionLOs.length,
        questionsCount: questions.length,
        choicesCount: choices.length,
        chaptersWithoutLOs: chapters.filter(c => 
          !learningObjectives.some(lo => lo.chapter_id === c.id)
        ).length,
        losWithoutQuestions: learningObjectives.filter(lo => 
          !questionLOs.some(qlo => qlo.lo_id === lo.id)
        ).length,
        questionsWithoutChoices: questions.filter(q => 
          !choices.some(c => c.question_id === q.id)
        ).length,
        questionsPerLO: learningObjectives.map(lo => ({
          lo_id: lo.id,
          lo_title: lo.title,
          question_count: questionLOs.filter(qlo => qlo.lo_id === lo.id).length,
          question_ids: questionLOs
            .filter(qlo => qlo.lo_id === lo.id)
            .map(qlo => qlo.question_id)
        })),
        questionsWithMultipleLOs: questions.filter(q => 
          questionLOs.filter(qlo => qlo.question_id === q.id).length > 1
        ).length,
        questionsWithNoLOs: questions.filter(q => 
          !questionLOs.some(qlo => qlo.question_id === q.id)
        ).length
      },
      details: {
        chapters,
        learningObjectives,
        questionLOs,
        questions,
        choices,
        questionLOsByLO: learningObjectives.map(lo => ({
          lo_id: lo.id,
          lo_title: lo.title,
          mappings: questionLOs.filter(qlo => qlo.lo_id === lo.id)
        })),
        questionLOsByQuestion: questions.map(q => ({
          question_id: q.id,
          question_text: q.question_rich_text,
          mappings: questionLOs.filter(qlo => qlo.question_id === q.id)
        }))
      }
    })
  } catch (error) {
    console.error('Error in check-data:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
} 