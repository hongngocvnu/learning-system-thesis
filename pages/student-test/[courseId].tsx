import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import Link from 'next/link'
import { LearningObjective, MABAssessment } from '../../services/mab'
import LearningPath from '../../components/LearningPath'
import { AdaptiveAssessmentSystem, Question as AdaptiveQuestion } from '../../lib/adaptive-assessment'

interface TestResult {
  score: number
  total: number
  answers: {
    questionId: number
    selectedAnswer: number
    isCorrect: boolean
  }[]
  weakLOs?: WeakLO[]
  loStats?: LOStat[]
}

interface WeakLO {
  id: number
  title: string
  lo_code: string
  prerequisites: number[]
  learning_path: {
    id: number
    title: string
    lo_code: string
    mastery: number
    confidence: number
  }[]
}

interface LOStat {
  id: number
  title: string
  lo_code: string
  mastery: number
  samples: number
}

export default function StudentTest() {
  const router = useRouter()
  const { courseId } = router.query
  const [assessment, setAssessment] = useState<AdaptiveAssessmentSystem | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<AdaptiveQuestion | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assessmentId, setAssessmentId] = useState<number | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [assessmentComplete, setAssessmentComplete] = useState(false)
  const [assessmentResults, setAssessmentResults] = useState<{
    totalQuestions: number;
    recommendedTopics: Array<{
      id: number;
      name: string;
      lcb: number;
      questionsAsked: number;
      successRate: number;
      confidence: number;
      mastery: number;
      hasEnoughData: boolean;
      prerequisites: number[];
      level: number;
    }>;
  }>({
    totalQuestions: 0,
    recommendedTopics: []
  })
  const [questionCount, setQuestionCount] = useState(0)
  const [userData, setUserData] = useState<{ id: number } | null>(null)
  const [answeredQuestions, setAnsweredQuestions] = useState<{
    questionId: number;
    isCorrect: boolean;
  }[]>([])

  useEffect(() => {
    const initializeAssessment = async () => {
      if (!courseId || typeof courseId !== 'string') return;

      try {
        setIsLoading(true)
        setError(null)

        // Get current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) {
          console.error('User authentication error:', userError)
          throw userError
        }
        if (!user) {
          console.error('No authenticated user found')
          throw new Error('User not authenticated')
        }

        // Get user_id from users table
        const { data: userData, error: userDataError } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single()

        if (userDataError) {
          console.error('Error fetching user data:', userDataError)
          throw userDataError
        }
        if (!userData) {
          console.error('User not found in database:', user.email)
          throw new Error('User not found in database')
        }

        setUserData(userData)

        // Create assessment session
        const { data: assessmentData, error: assessmentError } = await supabase
          .from('assessment_sessions')
          .insert({
            student_id: userData.id,
            course_id: courseId,
            start_time: new Date().toISOString(),
            status: 'in_progress',
            sampling_policy: 'Thompson',
            max_questions: 30,
            pre_sample_count: 5
          })
          .select()
          .single()

        if (assessmentError) {
          console.error('Error creating assessment session:', assessmentError)
          throw assessmentError
        }
        if (!assessmentData) {
          console.error('Failed to create assessment session')
          throw new Error('Failed to create assessment session')
        }
        
        console.log('Assessment session created:', assessmentData)
        setAssessmentId(assessmentData.id)

        // Initialize adaptive assessment system
        console.log('Initializing assessment system for course:', courseId)
        const newAssessment = await AdaptiveAssessmentSystem.initializeFromDatabase(
          courseId,
          userData.id,
          supabase,
          {
            maxQuestions: 40,
            minQuestionsPerTopic: 3,
            maxQuestionsPerTopic: 10,
            explorationFactor: 0.5,
            minQuestionsForConfidence: 2,
            masteryThreshold: 0.8,
            confidenceThreshold: 0.95
          }
        )

        console.log('Assessment initialized:', newAssessment)
        setAssessment(newAssessment)

        // Get first question
        const firstQuestion = newAssessment.getNextQuestion()
        console.log('First question:', firstQuestion)
        
        if (!firstQuestion) {
          console.error('No questions available for course:', courseId)
          setError('No questions are currently available for this course. Please contact your instructor.')
          return
        }

        setCurrentQuestion(firstQuestion)
        setQuestionCount(1)
      } catch (error: any) {
        console.error('Error initializing assessment:', error)
        setError(error.message || 'An error occurred while initializing the assessment')
      } finally {
        setIsLoading(false)
      }
    }

    if (courseId) {
      initializeAssessment()
    }
  }, [courseId])

  const handleAnswer = async () => {
    if (!currentQuestion || selectedAnswer === null || !assessment || !userData) return;

    try {
      setIsSubmitting(true);
      setError(null);

      const isCorrect = selectedAnswer === currentQuestion.correctOption;
      
      // Process answer in assessment system
      assessment.processAnswer(currentQuestion.id, isCorrect);
      
      // Add to answered questions
      setAnsweredQuestions(prev => [...prev, {
        questionId: currentQuestion.id,
        isCorrect
      }]);

      // Save answer to database
      const { error: answerError } = await supabase
        .from('assessment_results')
        .insert({
          assessment_id: assessmentId,
          question_id: currentQuestion.id,
          student_id: userData.id,
          is_correct: isCorrect,
          difficulty_level: currentQuestion.difficulty || 1.0,
          pseudo_rewards: {},
          confidence_bounds: {}
        });

      if (answerError) {
        console.error('Error saving answer:', answerError);
        throw answerError;
      }

      // Get next question
      const nextQuestion = assessment.getNextQuestion();
      if (nextQuestion) {
        setCurrentQuestion(nextQuestion);
        setSelectedAnswer(null);
        setQuestionCount(prev => prev + 1);
      } else {
        // Assessment complete
        await handleAssessmentComplete();
      }
    } catch (err) {
      console.error('Error processing answer:', err);
      setError('Failed to process answer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssessmentComplete = async () => {
    try {
      if (!assessment || !assessmentId) {
        console.error('Assessment or assessmentId is missing');
        return;
      }

      console.log('Starting assessment completion process...');
      
      // Save assessment results
      console.log('Saving assessment results...');
      await assessment.saveAssessmentResults(assessmentId);
      console.log('Successfully saved assessment results');

      // Update assessment session status
      console.log('Updating assessment session status...');
      const { error: updateError } = await supabase
        .from('assessment_sessions')
        .update({
          status: 'completed',
          end_time: new Date().toISOString()
        })
        .eq('id', assessmentId);

      if (updateError) {
        console.error('Error updating assessment session:', updateError);
        throw updateError;
      }
      console.log('Successfully updated assessment session');

      // Get final results
      const results = assessment.getAssessmentResults();
      console.log('Assessment results:', results);
      
      setAssessmentResults(results);
      setAssessmentComplete(true);
      setShowResults(true);
    } catch (error) {
      console.error('Error completing assessment:', error);
      setError('Failed to complete assessment. Please try again.');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  if (error) {
    return <div className="flex justify-center items-center min-h-screen text-red-500">{error}</div>
  }

  if (showResults) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {!assessmentComplete ? (
            <div className="container mx-auto px-4 py-8">
              <h1 className="text-2xl font-bold mb-6">Assessment Results</h1>
              {assessment && (
                <div className="space-y-4">
                  {assessment.getAssessmentResults().recommendedTopics.map(topic => (
                    <div key={topic.id} className="border p-4 rounded-lg">
                      <h2 className="text-xl font-semibold">{topic.name}</h2>
                      <p>Questions Asked: {topic.questionsAsked}</p>
                      <p>Success Rate: {(topic.successRate * 100).toFixed(1)}%</p>
                      <p>Confidence: {(topic.confidence * 100).toFixed(1)}%</p>
                      <p>Mastery: {(topic.mastery * 100).toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white shadow sm:rounded-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Assessment Results</h2>
              
              <div className="mb-8">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Weakest Learning Objectives</h3>
                <div className="space-y-4">
                  {assessmentResults.recommendedTopics
                    .filter(topic => {
                      // Only show topics with success rate = 0 and at least 1 question
                      return topic.successRate === 0 && topic.questionsAsked > 0;
                    })
                    .sort((a, b) => {
                      // Sort by number of questions (descending)
                      return b.questionsAsked - a.questionsAsked;
                    })
                    .map(topic => (
                      <div key={topic.id} className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">{topic.name}</h4>
                            <p className="text-sm text-gray-500">Success Rate: {topic.successRate.toFixed(1)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              Mastery: {topic.mastery.toFixed(1)}%
                            </p>
                            <p className="text-sm text-gray-500">
                              Questions: {topic.questionsAsked}
                            </p>
                          </div>
                        </div>
                        {topic.prerequisites && topic.prerequisites.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm text-gray-500">
                              Prerequisites: {topic.prerequisites.join(', ')}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">
                    Total Questions: {assessmentResults.totalQuestions}
                  </p>
                </div>
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => router.push(`/courses/${courseId}`)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Back to Course
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        {error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0f2a4e]"></div>
          </div>
        ) : currentQuestion ? (
          <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[#0f2a4e] mb-2">Question {questionCount} of {assessment?.getQuestionLimits().total.max}</h2>
              <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: currentQuestion.question_rich_text }} />
            </div>

            <div className="space-y-4 mb-6">
              {currentQuestion.choices.map((choice, index) => (
                <label
                  key={choice.id}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedAnswer === index
                      ? 'border-[#0f2a4e] bg-blue-50'
                      : 'border-gray-200 hover:border-[#0f2a4e]'
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={index}
                    checked={selectedAnswer === index}
                    onChange={() => setSelectedAnswer(index)}
                    className="mr-3"
                  />
                  <span className="text-gray-700">{choice.choice}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleAnswer}
                disabled={selectedAnswer === null || isSubmitting}
                className={`px-6 py-2 rounded ${
                  selectedAnswer !== null && !isSubmitting
                    ? 'bg-[#0f2a4e] text-white hover:bg-blue-800'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Answer'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">No questions available</h2>
            <p className="text-gray-600">Please contact your instructor for more information.</p>
          </div>
        )}
      </div>
    </div>
  )
}