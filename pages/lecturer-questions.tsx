// pages/lecturer-questions.js
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import Header from '../components/Header'
import { useRouter } from 'next/router'
import Link from 'next/link'

interface Question {
  id: number
  question_rich_text: string
  explanation: string
  difficulty: number
  concept_weight: number
  time_decay_factor: number
  created_by: number
  created_at: string
  choices?: Choice[]
}

interface Choice {
  id: number
  question_id: number
  choice: string
  is_correct: boolean
  created_at: string
}

interface QuestionChoice {
  id: number
  question_id: number
  content: string
  is_correct: boolean
}

interface Chapter {
  id: number
  course_id: number
  title: string
  order_num: number
  created_by: number
}

interface LearningObjective {
  id: number
  chapter_id: number
  title: string
  description: string
  lo_code: string
  created_by: number
}

interface QuestionLO {
  id: number
  question_id: number
  lo_id: number
}

interface Course {
  id: number
  name: string
  code: string
  description: string
  lecturer_id: number
  created_at: string
}

interface QuestionForm {
  question_rich_text: string
  explanation: string
  options: string[]
  correctAnswerIndex: number
  selectedLos: number[]
  difficulty: number
  concept_weight: number
  time_decay_factor: number
}

export default function QuestionManager() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<number | ''>('')
  const [selectedChapter, setSelectedChapter] = useState<number | ''>('')
  const [selectedLO, setSelectedLO] = useState<number | ''>('')
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionLOs, setQuestionLOs] = useState<QuestionLO[]>([])
  const [form, setForm] = useState<QuestionForm>({
    question_rich_text: '',
    explanation: '',
    options: ['', ''],
    correctAnswerIndex: 0,
    selectedLos: [],
    difficulty: 1.0,
    concept_weight: 1.0,
    time_decay_factor: 0.1
  })
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const questionsPerPage = 5
  const router = useRouter()

  useEffect(() => {
    const fetchUserAndData = async () => {
      try {
        setIsLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('No user found')
          return
        }
        
        setCurrentUserId(user.id)
        
        // First get the lecturer's user_id from users table
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single()

        if (userError) {
          console.error('Error fetching user data:', userError)
          return
        }

        if (!userData) {
          console.error('No user data found for:', user.email)
          return
        }

        console.log('Fetching courses for lecturer ID:', userData.id)
        
        // Fetch courses where lecturer_id matches the lecturer's user_id
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*')
          .eq('lecturer_id', userData.id)
          .order('name', { ascending: true })

        if (coursesError) {
          console.error('Error fetching courses:', coursesError)
          return
        }

        console.log('Fetched courses:', coursesData)
        if (coursesData) {
          setCourses(coursesData)
        }
      } catch (error) {
        console.error('Error in fetchUserAndData:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserAndData()
  }, [])

  // Fetch chapters when course is selected
  useEffect(() => {
    const fetchChapters = async () => {
      if (!selectedCourse) {
        setChapters([])
        setSelectedChapter('')
        return
      }

      try {
        setIsLoading(true)
        const { data: chaptersData, error: chaptersError } = await supabase
          .from('chapters')
          .select('*')
          .eq('course_id', selectedCourse)
          .order('order_num', { ascending: true })

        if (chaptersError) {
          console.error('Error fetching chapters:', chaptersError)
          return
        }

        if (chaptersData) {
          setChapters(chaptersData as Chapter[])
        }
      } catch (error) {
        console.error('Error in fetchChapters:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchChapters()
  }, [selectedCourse])

  // Fetch learning objectives when chapter is selected
  useEffect(() => {
    const fetchLearningObjectives = async () => {
      if (!selectedChapter) {
        setLearningObjectives([])
        setSelectedLO('')
        return
      }

      try {
        setIsLoading(true)
        const { data: losData, error: losError } = await supabase
          .from('learning_objectives')
          .select('*')
          .eq('chapter_id', selectedChapter)
          .order('lo_code', { ascending: true })

        if (losError) {
          console.error('Error fetching learning objectives:', losError)
          return
        }

        if (losData) {
          setLearningObjectives(losData as LearningObjective[])
        }
      } catch (error) {
        console.error('Error in fetchLearningObjectives:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchLearningObjectives()
  }, [selectedChapter])

  // Fetch questions when learning objective is selected
  useEffect(() => {
    const fetchQuestions = async () => {
      if (!selectedChapter || !currentUserId) return;

      try {
        setIsLoading(true)
        console.log('Fetching questions for chapter:', selectedChapter)

        // Fetch all learning objectives for the selected chapter
        const { data: losData, error: losError } = await supabase
          .from('learning_objectives')
          .select('*')
          .eq('chapter_id', selectedChapter)

        if (losError) {
          console.error('Error fetching learning objectives:', losError)
          return
        }

        if (!losData || losData.length === 0) {
          console.log('No learning objectives found for chapter:', selectedChapter)
          setQuestions([])
          return
        }

        console.log('Learning objectives found:', losData.length)

        // Fetch question-LO mappings
        const { data: questionLosData, error: qlosError } = await supabase
          .from('question_lo')
          .select('*')
          .in('lo_id', losData.map(lo => lo.id))

        if (qlosError) {
          console.error('Error fetching question-LO mappings:', qlosError)
          return
        }

        if (!questionLosData || questionLosData.length === 0) {
          console.log('No question mappings found for LOs:', losData.map(lo => lo.id))
          setQuestions([])
          return
        }

        console.log('Question-LO mappings found:', questionLosData.length)

        // Fetch questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('created_by', currentUserId)

        if (questionsError) {
          console.error('Error fetching questions:', questionsError)
          return
        }

        console.log('Questions found:', questionsData?.length || 0)
        console.log('Questions data:', questionsData)

        if (!questionsData || questionsData.length === 0) {
          console.error('No questions found for user:', currentUserId)
          return
        }

        // Fetch choices
        const { data: choicesData, error: choicesError } = await supabase
          .from('choices')
          .select('*')
          .in('question_id', questionsData.map(q => q.id))

        if (choicesError) {
          console.error('Error fetching choices:', choicesError)
          return
        }

        console.log('Choices found:', choicesData?.length || 0)
        console.log('Choices data:', choicesData)

        if (!choicesData || choicesData.length === 0) {
          console.error('No choices found for questions:', questionsData.map(q => q.id))
          return
        }

        // Map questions with their choices and learning objectives
        const mappedQuestions = questionsData.map(question => {
          const questionChoices = choicesData.filter(c => c.question_id === question.id)
          const questionLOs = questionLosData
            .filter(qlo => qlo.question_id === question.id)
            .map(qlo => losData.find(lo => lo.id === qlo.lo_id))
            .filter(Boolean)

          console.log(`Question ${question.id}:`, {
            choices: questionChoices.length,
            learningObjectives: questionLOs.length,
            learningObjectiveIds: questionLOs.map(lo => lo?.id)
          })

          return {
            ...question,
            choices: questionChoices,
            learningObjectives: questionLOs
          }
        })

        console.log('Mapped questions:', mappedQuestions.length)
        setQuestions(mappedQuestions)
      } catch (error) {
        console.error('Error in fetchQuestions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchQuestions()
  }, [selectedChapter, currentUserId])

  const handleAddChoice = () => {
    setForm(prev => ({
      ...prev,
      options: [...prev.options, '']
    }))
  }

  const handleRemoveChoice = (index: number) => {
    setForm(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }))
  }

  const handleOptionChange = (index: number, value: string) => {
    setForm(prev => ({
      ...prev,
      options: prev.options.map((option, i) => i === index ? value : option)
    }))
  }

  const handleEdit = (question: Question) => {
    setEditingQuestionId(question.id)
    setForm({
      question_rich_text: question.question_rich_text,
      explanation: question.explanation,
      options: question.choices?.map(c => c.choice) || ['', ''],
      correctAnswerIndex: question.choices?.findIndex(c => c.is_correct) || 0,
      selectedLos: questionLOs
        .filter(qlo => qlo.question_id === question.id)
        .map(qlo => qlo.lo_id),
      difficulty: question.difficulty,
      concept_weight: question.concept_weight,
      time_decay_factor: question.time_decay_factor
    })
    setIsPopupOpen(true)
  }

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm('Are you sure you want to delete this question?')) return

    try {
      setIsLoading(true)

      // First, delete all choices associated with the question
      const { error: choicesError } = await supabase
        .from('choices')
        .delete()
        .eq('question_id', questionId)

      if (choicesError) {
        console.error('Error deleting choices:', choicesError)
        throw new Error(`Failed to delete choices: ${choicesError.message}`)
      }

      // Then, delete all question_lo mappings
      const { error: questionLoError } = await supabase
        .from('question_lo')
        .delete()
        .eq('question_id', questionId)

      if (questionLoError) {
        console.error('Error deleting question-LO mappings:', questionLoError)
        throw new Error(`Failed to delete question-LO mappings: ${questionLoError.message}`)
      }

      // Finally, delete the question itself
      const { error: questionError } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)

      if (questionError) {
        console.error('Error deleting question:', questionError)
        throw new Error(`Failed to delete question: ${questionError.message}`)
      }

      // Refresh the questions list
      const { data: updatedQuestions, error: fetchError } = await supabase
        .from('questions')
        .select('*')
        .eq('created_by', currentUserId)

      if (fetchError) {
        console.error('Error fetching updated questions:', fetchError)
      } else if (updatedQuestions) {
        setQuestions(updatedQuestions)
      }

      alert('Question deleted successfully!')
    } catch (error: any) {
      console.error('Error in handleDeleteQuestion:', error)
      alert(`An error occurred while deleting the question: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setIsLoading(true)

      if (!form.question_rich_text || form.options.length < 2) {
        alert('Please fill in all required fields and add at least 2 options')
        return
      }

      // First, create or update the question
      const questionData = {
        question_rich_text: form.question_rich_text,
        explanation: form.explanation,
        difficulty: form.difficulty || 1.0,
        concept_weight: form.concept_weight || 1.0,
        time_decay_factor: form.time_decay_factor || 0.1,
        created_by: currentUserId
      }

      let questionId: number;
      let questionError;
      if (editingQuestionId) {
        const { error } = await supabase
          .from('questions')
          .update(questionData)
          .eq('id', editingQuestionId)
        questionError = error;
        questionId = editingQuestionId;
      } else {
        const { data, error } = await supabase
          .from('questions')
          .insert([questionData])
          .select()
        questionError = error;
        if (data && data.length > 0) {
          questionId = data[0].id;
        } else {
          throw new Error('Failed to create question: No ID returned')
        }
      }

      if (questionError) {
        console.error('Error saving question:', questionError)
        throw new Error(`Failed to save question: ${questionError.message}`)
      }

      // Delete existing choices if editing
      if (editingQuestionId) {
        const { error: deleteError } = await supabase
          .from('choices')
          .delete()
          .eq('question_id', editingQuestionId)

        if (deleteError) {
          console.error('Error deleting existing choices:', deleteError)
          throw new Error(`Failed to delete existing choices: ${deleteError.message}`)
        }
      }

      // Insert new choices
      const choicesData = form.options.map((option, index) => ({
        question_id: questionId,
        choice: option,
        is_correct: index === form.correctAnswerIndex
      }))

      const { error: choicesError } = await supabase
        .from('choices')
        .insert(choicesData)

      if (choicesError) {
        console.error('Error saving choices:', choicesError)
        // If choices insertion fails, try to delete the question to maintain consistency
        if (!editingQuestionId) {
          await supabase
            .from('questions')
            .delete()
            .eq('id', questionId)
        }
        throw new Error(`Failed to save choices: ${choicesError.message}`)
      }

      // Update question-LO mappings
      if (editingQuestionId) {
        const { error: deleteMappingsError } = await supabase
          .from('question_lo')
          .delete()
          .eq('question_id', editingQuestionId)

        if (deleteMappingsError) {
          console.error('Error deleting existing mappings:', deleteMappingsError)
          throw new Error(`Failed to delete existing mappings: ${deleteMappingsError.message}`)
        }
      }

      const mappingsData = form.selectedLos.map(loId => ({
        question_id: questionId,
        lo_id: loId
      }))

      const { error: mappingsError } = await supabase
        .from('question_lo')
        .insert(mappingsData)

      if (mappingsError) {
        console.error('Error saving mappings:', mappingsError)
        // If mappings insertion fails, try to clean up
        if (!editingQuestionId) {
          await supabase
            .from('questions')
            .delete()
            .eq('id', questionId)
          await supabase
            .from('choices')
            .delete()
            .eq('question_id', questionId)
        }
        throw new Error(`Failed to save mappings: ${mappingsError.message}`)
      }

      // Reset form and refresh questions
      setForm({
        question_rich_text: '',
        explanation: '',
        options: ['', ''],
        correctAnswerIndex: 0,
        selectedLos: [],
        difficulty: 1.0,
        concept_weight: 1.0,
        time_decay_factor: 0.1
      })
      setEditingQuestionId(null)
      setIsPopupOpen(false)

      // Refresh questions list
      if (selectedLO && currentUserId) {
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('created_by', currentUserId)

        if (questionsError) {
          console.error('Error fetching updated questions:', questionsError)
        } else if (questionsData) {
          // Get all question-LO mappings for the selected LO
          const { data: questionLOsData } = await supabase
            .from('question_lo')
            .select('*')
            .eq('lo_id', selectedLO)

          // Get choices for all questions
          const { data: choicesData } = await supabase
            .from('choices')
            .select('*')
            .in('question_id', questionsData.map(q => q.id))

          // Filter questions to only show those mapped to the selected LO
          const filteredQuestions = questionsData
            .filter(question => questionLOsData?.some(qlo => qlo.question_id === question.id))
            .map(question => ({
              ...question,
              choices: choicesData?.filter(c => c.question_id === question.id) || []
            }))

          setQuestions(filteredQuestions)
          setQuestionLOs(questionLOsData || [])
        }
      }

      alert(`Question ${editingQuestionId ? 'updated' : 'added'} successfully!`)
    } catch (error: any) {
      console.error('Error in handleSubmit:', error)
      alert(`An error occurred while saving the question: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const generateQuestion = async () => {
    if (!selectedCourse || !selectedChapter || form.selectedLos.length === 0) {
      alert('Please select a course, chapter, and at least one learning objective first')
      return
    }

    try {
      setIsLoading(true)
      
      // Get the selected course and chapter names
      const selectedCourseData = courses.find(c => c.id === Number(selectedCourse));
      const selectedChapterData = chapters.find(c => c.id === selectedChapter);
      const selectedLOData = learningObjectives.find(lo => lo.id === form.selectedLos[0]);

      if (!selectedCourseData || !selectedChapterData || !selectedLOData) {
        throw new Error('Could not find selected course, chapter, or learning objective details');
      }

      const res = await fetch('/api/auto-generate-question', {
        method: 'POST',
        body: JSON.stringify({
          course: selectedCourseData.name,
          chapter: selectedChapterData.title,
          learningObjective: selectedLOData.title,
          difficulty: form.difficulty
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate question')
      }

      if (!data.question || !data.options || !data.answer) {
        throw new Error('Invalid response format from the server')
      }
      
      // Parse options if it's a string
      const options = typeof data.options === 'string' ? JSON.parse(data.options) : data.options
      
      // Find the index of the correct answer in the options array
      const answerIndex = options.findIndex((option: string) => option === data.answer)
      const letterAnswer = answerIndex !== -1 ? String.fromCharCode(65 + answerIndex) : ''
      
      // Update form with generated data
      setForm({
        ...form,
        question_rich_text: data.question,
        options: options,
        correctAnswerIndex: answerIndex,
        explanation: data.explanation || '',
        difficulty: form.difficulty,
        concept_weight: data.concept_weight || 1.0,
        time_decay_factor: data.time_decay_factor || 0.1
      })
    } catch (error) {
      console.error('Error generating question:', error)
      if (error instanceof Error) {
        if (error.message.includes('Ollama service')) {
          alert('The question generation service is not running. Please contact your administrator.')
        } else {
          alert(error.message)
        }
      } else {
        alert('Failed to generate question. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Add this to reset pagination when chapter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedChapter])

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header />
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Link 
            href="/dashboard-lecturer" 
            className="flex items-center text-[#0f2a4e] hover:text-blue-800 transition-colors duration-200"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6 mr-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M10 19l-7-7m0 0l7-7m-7 7h18" 
              />
            </svg>
            Back to Dashboard
          </Link>
          <button
            onClick={() => setIsPopupOpen(true)}
            className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
          >
            Add New Question
          </button>
        </div>
        <h1 className="text-2xl font-bold mb-4 text-[#0f2a4e]">Manage Questions</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Course and Chapter Selection */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-[#0f2a4e]">Course Selection</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Course
                </label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={selectedCourse}
                  onChange={(e) => {
                    console.log('Selected course:', e.target.value)
                    setSelectedCourse(e.target.value ? Number(e.target.value) : '')
                    setSelectedChapter('')
                    setSelectedLO('')
                  }}
                  disabled={isLoading}
                >
                  <option value="">Select a course</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>
                      {course.code} - {course.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCourse && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Chapter
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={selectedChapter}
                    onChange={(e) => {
                      setSelectedChapter(e.target.value ? Number(e.target.value) : '')
                      setSelectedLO('')
                    }}
                    disabled={isLoading}
                  >
                    <option value="">Select a chapter</option>
                    {chapters.map(chapter => (
                      <option key={chapter.id} value={chapter.id}>
                        Chapter {chapter.order_num}: {chapter.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedChapter && (
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Learning Objectives</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {learningObjectives.map(lo => (
                      <div 
                        key={lo.id}
                        className={`p-3 rounded cursor-pointer transition-colors duration-200 ${
                          selectedLO === lo.id ? 'bg-[#0f2a4e] text-white' : 'hover:bg-gray-100'
                        }`}
                        onClick={() => setSelectedLO(lo.id)}
                      >
                        <div className="font-semibold">{lo.lo_code}</div>
                        <div className="text-sm">{lo.title}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Questions List */}
          <div className="md:col-span-2 bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-[#0f2a4e]">
              {selectedChapter ? 'Questions for Selected Chapter' : 'All Questions'}
            </h2>
            {isLoading ? (
              <div className="text-center py-4">Loading questions...</div>
            ) : questions.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                {selectedChapter ? 'No questions found for this chapter' : 'Please select a chapter to view questions'}
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {questions
                    .slice((currentPage - 1) * questionsPerPage, currentPage * questionsPerPage)
                    .map(question => {
                      const mappedQuestionLOs = questionLOs.filter(qlo => qlo.question_id === question.id)
                      const mappedLOs = mappedQuestionLOs.map(qlo => 
                        learningObjectives.find(lo => lo.id === qlo.lo_id)
                      ).filter(Boolean) as LearningObjective[]

                      return (
                        <div key={question.id} className="border rounded p-4 hover:bg-gray-50">
                          <div className="font-semibold mb-2">{question.question_rich_text}</div>
                          <div className="text-sm text-gray-600 mb-2">
                            Difficulty: {question.difficulty === 1 ? 'Easy' : question.difficulty === 2 ? 'Medium' : 'Hard'} ({question.difficulty})
                          </div>
                          {question.explanation && (
                            <div className="text-sm text-gray-600 mb-2">
                              Explanation: {question.explanation}
                            </div>
                          )}
                          {mappedLOs.length > 0 && (
                            <div className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">Mapped Learning Objectives:</span>
                              <ul className="list-disc list-inside mt-1">
                                {mappedLOs.map(lo => (
                                  <li key={lo.id}>
                                    <span className="font-semibold">{lo.lo_code}</span> - {lo.title}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleEdit(question)}
                              className="text-blue-600 hover:text-blue-800"
                              disabled={isLoading}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(question.id)}
                              className="text-red-600 hover:text-red-800"
                              disabled={isLoading}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )
                    })}
                </div>

                {/* Pagination */}
                {questions.length > questionsPerPage && (
                  <div className="mt-6 flex justify-center items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-gray-600">
                      Page {currentPage} of {Math.ceil(questions.length / questionsPerPage)}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(questions.length / questionsPerPage)))}
                      disabled={currentPage === Math.ceil(questions.length / questionsPerPage)}
                      className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Add/Edit Question Popup */}
        {isPopupOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center overflow-y-auto py-8">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-[#0f2a4e]">
                  {editingQuestionId ? 'Edit Question' : 'Add New Question'}
                </h2>
                <div className="flex space-x-2">
                  <select
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: parseFloat(e.target.value) })}
                    className="border rounded px-3 py-2"
                    disabled={isLoading}
                  >
                    <option value={1}>Easy</option>
                    <option value={2}>Medium</option>
                    <option value={3}>Hard</option>
                  </select>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">Concept Weight:</label>
                    <input
                      type="number"
                      min="0.1"
                      max="5.0"
                      step="0.1"
                      value={form.concept_weight}
                      onChange={(e) => setForm({ ...form, concept_weight: parseFloat(e.target.value) })}
                      className="w-20 border rounded px-2 py-1"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm text-gray-600">Time Decay:</label>
                    <input
                      type="number"
                      min="0.01"
                      max="0.5"
                      step="0.01"
                      value={form.time_decay_factor}
                      onChange={(e) => setForm({ ...form, time_decay_factor: parseFloat(e.target.value) })}
                      className="w-20 border rounded px-2 py-1"
                      disabled={isLoading}
                    />
                  </div>
                  <button
                    onClick={generateQuestion}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                    disabled={isLoading || !selectedCourse || !selectedChapter || form.selectedLos.length === 0}
                  >
                    Auto Generate
                  </button>
                  <button
                    onClick={() => {
                      setIsPopupOpen(false)
                      setEditingQuestionId(null)
                      setForm({
                        question_rich_text: '',
                        explanation: '',
                        options: ['', ''],
                        correctAnswerIndex: 0,
                        selectedLos: [],
                        difficulty: 1.0,
                        concept_weight: 1.0,
                        time_decay_factor: 0.1
                      })
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course *
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={selectedCourse}
                    onChange={(e) => {
                      console.log('Selected course:', e.target.value)
                      setSelectedCourse(e.target.value ? Number(e.target.value) : '')
                      setSelectedChapter('')
                      setSelectedLO('')
                    }}
                    disabled={isLoading}
                  >
                    <option value="">Select a course</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCourse && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Chapter *
                    </label>
                    <select
                      className="w-full border rounded px-3 py-2"
                      value={selectedChapter}
                      onChange={(e) => {
                        setSelectedChapter(e.target.value ? Number(e.target.value) : '')
                        setSelectedLO('')
                      }}
                      disabled={isLoading}
                    >
                      <option value="">Select a chapter</option>
                      {chapters.map(chapter => (
                        <option key={chapter.id} value={chapter.id}>
                          Chapter {chapter.order_num}: {chapter.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedChapter && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Learning Objectives *
                    </label>
                    <div className="border rounded p-2 max-h-60 overflow-y-auto">
                      {learningObjectives.map(lo => (
                        <div key={lo.id} className="flex items-center space-x-2 p-1 hover:bg-gray-50">
                          <input
                            type="checkbox"
                            id={`lo-${lo.id}`}
                            checked={form.selectedLos.includes(lo.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm({
                                  ...form,
                                  selectedLos: [...form.selectedLos, lo.id]
                                })
                              } else {
                                setForm({
                                  ...form,
                                  selectedLos: form.selectedLos.filter(id => id !== lo.id)
                                })
                              }
                            }}
                            className="h-4 w-4"
                            disabled={isLoading}
                          />
                          <label htmlFor={`lo-${lo.id}`} className="text-sm cursor-pointer">
                            {lo.lo_code} - {lo.title}
                          </label>
                        </div>
                      ))}
                    </div>
                    {form.selectedLos.length === 0 && (
                      <p className="text-sm text-red-500 mt-1">
                        Please select at least one learning objective
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question Content *
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2"
                    value={form.question_rich_text}
                    onChange={(e) => setForm({ ...form, question_rich_text: e.target.value })}
                    rows={3}
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Explanation
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2"
                    value={form.explanation}
                    onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                    rows={3}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Options *
                  </label>
                  {form.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={form.correctAnswerIndex === index}
                        onChange={() => setForm({ ...form, correctAnswerIndex: index })}
                        className="h-4 w-4"
                        disabled={isLoading}
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleOptionChange(index, e.target.value)}
                        className="flex-1 border rounded px-3 py-2"
                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveChoice(index)}
                        className="text-red-600 hover:text-red-800"
                        disabled={isLoading}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddChoice}
                    className="text-blue-600 hover:text-blue-800"
                    disabled={isLoading}
                  >
                    Add Option
                  </button>
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setIsPopupOpen(false)
                      setEditingQuestionId(null)
                      setForm({
                        question_rich_text: '',
                        explanation: '',
                        options: ['', ''],
                        correctAnswerIndex: 0,
                        selectedLos: [],
                        difficulty: 1.0,
                        concept_weight: 1.0,
                        time_decay_factor: 0.1
                      })
                    }}
                    className="px-4 py-2 border rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800 disabled:opacity-50"
                    disabled={isLoading}
                  >
                    {editingQuestionId ? 'Update Question' : 'Add Question'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
