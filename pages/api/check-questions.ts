import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const courseId = req.query.courseId as string || '1'

  try {
    // Get all learning objectives for the course
    const { data: learningObjectives, error: losError } = await supabase
      .from('learning_objectives')
      .select(`
        id,
        title,
        chapter_id,
        chapters (
          id,
          title,
          course_id
        )
      `)
      .eq('chapters.course_id', courseId)

    if (losError) {
      return res.status(500).json({ error: 'Error fetching learning objectives', details: losError })
    }

    // Get question counts for each LO
    const loDetails = await Promise.all(
      learningObjectives?.map(async (lo) => {
        const { data: questionLOs, error: qlosError } = await supabase
          .from('question_lo')
          .select('question_id')
          .eq('lo_id', lo.id)

        if (qlosError) {
          console.error(`Error fetching questions for LO ${lo.id}:`, qlosError)
          return {
            ...lo,
            question_count: 0,
            error: qlosError.message
          }
        }

        return {
          ...lo,
          question_count: questionLOs?.length || 0
        }
      }) || []
    )

    // Group by chapter
    const chapters = learningObjectives?.reduce((acc, lo) => {
      const chapterId = lo.chapter_id
      if (!acc[chapterId]) {
        acc[chapterId] = {
          id: chapterId,
          title: lo.chapters?.[0]?.title,
          learning_objectives: []
        }
      }
      acc[chapterId].learning_objectives.push(lo)
      return acc
    }, {} as Record<number, any>)

    return res.status(200).json({
      course_id: courseId,
      total_learning_objectives: learningObjectives?.length || 0,
      learning_objectives_with_questions: loDetails.filter(lo => lo.question_count > 0).length,
      learning_objectives_with_enough_questions: loDetails.filter(lo => lo.question_count >= 8).length,
      chapters: Object.values(chapters || {}),
      learning_objectives: loDetails.map(lo => ({
        id: lo.id,
        title: lo.title,
        chapter_id: lo.chapter_id,
        chapter_title: lo.chapters?.[0]?.title,
        question_count: lo.question_count,
        has_enough_questions: lo.question_count >= 8
      }))
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return res.status(500).json({ error: 'Unexpected error occurred', details: error })
  }
} 