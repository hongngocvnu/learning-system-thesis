import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import Link from 'next/link'
import { v4 as uuidv4 } from 'uuid'

interface Choice {
  id: string
  question_id: string
  choice: string
  is_correct: boolean
}

interface Question {
  id: string
  content: string
  explanation: string
  difficulty: number
  choices: Choice[]
}

interface TestResult {
  score: number
  total: number
  answers: {
    questionId: string
    selectedAnswer: string
    isCorrect: boolean
  }[]
}

export default function StudentTest() {
  const router = useRouter()
  const { courseId } = router.query
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  useEffect(() => {
    if (router.isReady && courseId) {
      fetchQuestions()
    }
  }, [router.isReady, courseId])

  const fetchQuestions = async () => {
    if (!courseId || typeof courseId !== 'string') return

    try {
      setIsLoading(true)
      
      // First, get the course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (courseError) {
        console.error('Error fetching course:', courseError)
        return
      }

      if (!courseData) {
        console.error('Course not found')
        return
      }

      console.log('Course details:', courseData)
      
      // Get all chapters for the course
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', courseId)
        .order('order_num', { ascending: true })

      if (chaptersError) {
        console.error('Error fetching chapters:', chaptersError)
        return
      }

      if (!chaptersData || chaptersData.length === 0) {
        console.error('No chapters found for this course')
        return
      }

      console.log('Chapters:', chaptersData)
      
      const chapterIds = chaptersData.map(chapter => chapter.id)
      
      // Get learning objectives for these chapters
      const { data: losData, error: losError } = await supabase
        .from('learning_objectives')
        .select('*')
        .in('chapter_id', chapterIds)
        .order('lo_code', { ascending: true })

      if (losError) {
        console.error('Error fetching learning objectives:', losError)
        return
      }

      if (!losData || losData.length === 0) {
        console.error('No learning objectives found for these chapters')
        return
      }

      console.log('Learning Objectives:', losData)
      
      const loIds = losData.map(lo => lo.id)
      
      // Get questions associated with these learning objectives
      const { data: questionLosData, error: questionLosError } = await supabase
        .from('question_lo')
        .select('question_id')
        .in('lo_id', loIds)

      if (questionLosError) {
        console.error('Error fetching question-LO mappings:', questionLosError)
        return
      }

      if (!questionLosData || questionLosData.length === 0) {
        console.error('No questions found for these learning objectives')
        return
      }

      const questionIds = questionLosData.map(qlo => qlo.question_id)
      
      // Get the actual questions
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .in('id', questionIds)

      if (questionsError) {
        console.error('Error fetching questions:', questionsError)
        return
      }

      if (!questionsData || questionsData.length === 0) {
        console.error('No questions found')
        return
      }

      // Get choices for all questions
      const { data: choicesData, error: choicesError } = await supabase
        .from('choices')
        .select('*')
        .in('question_id', questionIds)

      if (choicesError) {
        console.error('Error fetching choices:', choicesError)
        return
      }

      if (!choicesData || choicesData.length === 0) {
        console.error('No choices found for the questions')
        return
      }

      // Combine questions with their choices and ensure proper format
      const questionsWithChoices = questionsData.map(question => {
        const questionChoices = choicesData.filter(choice => choice.question_id === question.id)
        
        // Ensure choices are properly formatted
        const formattedChoices = questionChoices.map(choice => ({
          id: choice.id,
          question_id: choice.question_id,
          choice: choice.choice,
          is_correct: choice.is_correct
        }))

        // Verify we have at least one correct choice
        const hasCorrectChoice = formattedChoices.some(choice => choice.is_correct)
        if (!hasCorrectChoice) {
          console.error(`Question ${question.id} has no correct choice`)
        }

        return {
          ...question,
          choices: formattedChoices
        }
      })

      // Filter out questions without choices or without correct answers
      const validQuestions = questionsWithChoices.filter(q => 
        q.choices.length > 0 && q.choices.some((c: Choice) => c.is_correct)
      )

      if (validQuestions.length === 0) {
        console.error('No valid questions found (questions must have choices and at least one correct answer)')
        return
      }

      // Select 5 random questions
      const shuffled = validQuestions.sort(() => 0.5 - Math.random())
      const selected = shuffled.slice(0, 5)
      
      console.log('Selected questions with choices:', selected)
      setQuestions(selected)
    } catch (error) {
      console.error('Error in fetchQuestions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (questions.length === 0) return

    try {
      setIsSubmitting(true)

      // Get current user from auth
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Error getting user:', userError)
        throw new Error('Failed to get user information')
      }
      if (!user) {
        throw new Error('User not authenticated')
      }

      console.log('Auth User:', user)
      console.log('CourseId:', courseId)

      // Get user_id from users table
      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single()

      if (userDataError) {
        console.error('Error getting user data:', userDataError)
        throw new Error('Failed to get user data')
      }
      if (!userData) {
        throw new Error('User not found in database')
      }

      console.log('User Data from users table:', userData)

      // Create assessment record with exact schema
      const assessmentData = {
        id: uuidv4(),
        student_id: userData.id,
        course_id: courseId,
        created_at: new Date().toISOString()
      }

      console.log('Attempting to create assessment with data:', assessmentData)

      const { data: newAssessment, error: assessmentError } = await supabase
        .from('assessments')
        .insert([assessmentData])
        .select()
        .single()

      if (assessmentError) {
        console.error('Error creating assessment:', assessmentError)
        console.error('Assessment insert details:', {
          student_id: userData.id,
          course_id: courseId,
          error: assessmentError
        })
        throw new Error(`Failed to create assessment: ${assessmentError.message}`)
      }

      if (!newAssessment) {
        throw new Error('Failed to create assessment: No data returned')
      }

      console.log('Created assessment:', newAssessment)

      // Create assessment results for each question with exact schema
      const assessmentResults = questions.map(question => {
        // Get the selected answer for this question
        const selectedAnswer = selectedAnswers[question.id]
        // Find the correct choice
        const correctChoice = question.choices.find(choice => choice.is_correct)
        
        // Compare the selected answer with the correct choice
        const isCorrect = selectedAnswer === correctChoice?.choice

        console.log('Question:', question.id)
        console.log('Selected Answer:', selectedAnswer)
        console.log('Correct Choice:', correctChoice?.choice)
        console.log('Is Correct:', isCorrect)

        return {
          id: uuidv4(),
          question_id: question.id,
          is_correct: isCorrect,
          student_id: userData.id,
          difficulty_level: question.difficulty,
          assessment_id: newAssessment.id
        }
      })

      console.log('Assessment results to insert:', assessmentResults)

      const { error: resultsError } = await supabase
        .from('assessment_results')
        .insert(assessmentResults)

      if (resultsError) {
        console.error('Error creating assessment results:', resultsError)
        console.error('Results insert details:', {
          assessment_id: newAssessment.id,
          results: assessmentResults,
          error: resultsError
        })
        throw new Error(`Failed to save assessment results: ${resultsError.message}`)
      }

      // Calculate score
      const score = assessmentResults.filter(result => result.is_correct).length
      const total = questions.length

      console.log('Test submitted successfully. Score:', score, '/', total)

      setTestResult({
        score,
        total,
        answers: questions.map(question => {
          const selectedAnswer = selectedAnswers[question.id]
          const correctChoice = question.choices.find(choice => choice.is_correct)
          const isCorrect = selectedAnswer === correctChoice?.choice

          return {
            questionId: question.id,
            selectedAnswer: selectedAnswer || '',
            isCorrect: isCorrect
          }
        })
      })
    } catch (error) {
      console.error('Error submitting test:', error)
      alert(`Error submitting test: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading questions...</div>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-red-500">No questions available for this course</div>
          <div className="mt-4 text-center">
            <Link 
              href={`/student-course/${courseId}`}
              className="text-[#0f2a4e] hover:text-blue-800"
            >
              Back to Course
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (testResult) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-[#0f2a4e] mb-4">Test Results</h2>
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-[#0f2a4e]">
                {testResult.score}/{testResult.total}
              </div>
              <div className="text-gray-600">
                {Math.round((testResult.score / testResult.total) * 100)}% Correct
              </div>
            </div>
            <div className="space-y-4">
              {testResult.answers.map((answer, index) => {
                const question = questions.find(q => q.id === answer.questionId)
                return (
                  <div 
                    key={answer.questionId}
                    className={`p-4 rounded-lg ${
                      answer.isCorrect ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <div className="font-medium text-[#0f2a4e]">
                      Question {index + 1}
                    </div>
                    <div className="mt-2">
                      <div className="text-gray-600">Your answer: {answer.selectedAnswer || 'Not answered'}</div>
                      <div className="text-gray-600">Correct answer: {question?.choices.find(c => c.is_correct)?.choice}</div>
                      {question?.explanation && (
                        <div className="mt-2 text-sm text-gray-500">
                          Explanation: {question.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-6 text-center">
              <Link 
                href={`/student-course/${courseId}`}
                className="bg-[#0f2a4e] text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition-colors"
              >
                Back to Course
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div className="text-gray-600">
              Question {currentQuestionIndex + 1} of {questions.length}
            </div>
            <div className="text-sm text-gray-500">
              Difficulty: {currentQuestion.difficulty === 1 ? 'Easy' : currentQuestion.difficulty === 2 ? 'Medium' : 'Hard'}
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-[#0f2a4e] mb-4">
              {currentQuestion.content}
            </h3>
            <div className="space-y-3">
              {currentQuestion.choices.map((choice, index) => (
                <label 
                  key={choice.id}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedAnswers[currentQuestion.id] === choice.choice
                      ? 'border-[#0f2a4e] bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={choice.choice}
                    checked={selectedAnswers[currentQuestion.id] === choice.choice}
                    onChange={() => handleAnswerSelect(currentQuestion.id, choice.choice)}
                    className="mr-3"
                  />
                  <span className="text-gray-700">{choice.choice}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
              className={`px-4 py-2 rounded-lg ${
                currentQuestionIndex === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-[#0f2a4e] text-white hover:bg-blue-800'
              }`}
            >
              Previous
            </button>

            {currentQuestionIndex === questions.length - 1 ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-[#0f2a4e] text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Test'}
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                className="bg-[#0f2a4e] text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 