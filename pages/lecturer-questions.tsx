// pages/lecturer-questions.js
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import Header from '../components/Header'
import { useRouter } from 'next/router'
import Link from 'next/link'

interface Question {
  id: string
  content: string
  explanation: string
  difficulty: number
  type: string
  is_approved: boolean
  created_by: string
  options: string[]
  answer: string
}

interface QuestionChoice {
  id: string
  question_id: string
  content: string
  is_correct: boolean
}

interface Chapter {
  id: string
  course_id: string
  title: string
  order_num: number
  created_by: string
}

interface LearningObjective {
  id: string
  chapter_id: string
  title: string
  description: string
  lo_code: string
  created_by: string
}

interface QuestionLO {
  id: string
  question_id: string
  lo_id: string
}

interface Course {
  id: string
  title: string
  code: string
  name: string
}

export default function QuestionManager() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedChapter, setSelectedChapter] = useState('')
  const [selectedLO, setSelectedLO] = useState('')
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionLOs, setQuestionLOs] = useState<QuestionLO[]>([])
  const [form, setForm] = useState<{
    content: string;
    options: string[];
    answer: string;
    explanation: string;
    difficulty: number;
    selectedLos: string[];
  }>({
    content: '',
    options: ['', '', '', ''],
    answer: '',
    explanation: '',
    difficulty: 1,
    selectedLos: []
  })
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
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
        
        // Fetch courses where lecturer_id matches the current user
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*')
          .eq('lecturer_id', user.id)
          .order('name', { ascending: true })

        if (coursesError) {
          console.error('Error fetching courses:', coursesError)
          return
        }

        if (coursesData) {
          setCourses(coursesData as Course[])
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
      if (!selectedLO) {
        setQuestions([])
        return
      }

      try {
        setIsLoading(true)

        // First, get all questions for the current user
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('created_by', currentUserId)

        if (questionsError) {
          console.error('Error fetching questions:', questionsError)
          return
        }

        if (!questionsData) {
          setQuestions([])
          return
        }

        // Get all question-LO mappings for the selected LO
        const { data: questionLOsData, error: questionLOsError } = await supabase
          .from('question_lo')
          .select('*')
          .eq('lo_id', selectedLO)

        if (questionLOsError) {
          console.error('Error fetching question-LO mappings:', questionLOsError)
          return
        }

        // Filter questions to only show those mapped to the selected LO
        const filteredQuestions = questionsData.filter(question => 
          questionLOsData?.some(qlo => qlo.question_id === question.id)
        )

        setQuestions(filteredQuestions)
        setQuestionLOs(questionLOsData || [])
      } catch (error) {
        console.error('Error in fetchQuestions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchQuestions()
  }, [selectedLO, currentUserId])

  const handleAddChoice = () => {
    setForm({
      ...form,
      options: [...form.options, '']
    })
  }

  const handleRemoveChoice = (index: number) => {
    const options = form.options.filter((_, i) => i !== index)
    setForm({
      ...form,
      options
    })
  }

  const handleChoiceChange = (index: number, field: string, value: string | boolean) => {
    const options = form.options.map((option, i) => i === index ? value.toString() : option)
    setForm({
      ...form,
      options
    })
  }

  const handleEditQuestion = (question: Question) => {
    setEditingQuestionId(question.id)
    setForm({
      content: question.content,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      difficulty: question.difficulty,
      selectedLos: questionLOs
        .filter(qlo => qlo.question_id === question.id)
        .map(qlo => qlo.lo_id)
    })
    setIsPopupOpen(true)
  }

  const handleDeleteQuestion = async (questionId: string) => {
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
    if (!form.content) {
      alert('Please enter the question content')
      return
    }
    if (!currentUserId) {
      alert('User not authenticated')
      return
    }
    if (form.selectedLos.length === 0) {
      alert('Please select at least one learning objective')
      return
    }
    if (!form.answer) {
      alert('Please select the correct answer')
      return
    }

    try {
      setIsLoading(true)
      const questionId = editingQuestionId || uuidv4()

      // First, create the question
      const { error: questionError } = await supabase
        .from('questions')
        [editingQuestionId ? 'update' : 'insert']({
          id: questionId,
          content: form.content,
          explanation: form.explanation,
          difficulty: form.difficulty,
          created_by: currentUserId
        })
        .eq(editingQuestionId ? 'id' : 'id', questionId)

      if (questionError) {
        console.error('Error saving question:', questionError)
        throw new Error(`Failed to save question: ${questionError.message}`)
      }

      // If editing, delete existing choices first
      if (editingQuestionId) {
        const { error: deleteError } = await supabase
          .from('choices')
          .delete()
          .eq('question_id', questionId)

        if (deleteError) {
          console.error('Error deleting existing choices:', deleteError)
          throw new Error(`Failed to delete existing choices: ${deleteError.message}`)
        }
      }

      // Create choices one by one to better handle errors
      for (let i = 0; i < form.options.length; i++) {
        const option = form.options[i]
        if (!option.trim()) {
          throw new Error(`Option ${String.fromCharCode(65 + i)} cannot be empty`)
        }

        const isCorrect = String.fromCharCode(65 + i) === form.answer
        const { error: choiceError } = await supabase
          .from('choices')
          .insert({
            id: uuidv4(),
            question_id: questionId,
            choice: option,
            is_correct: isCorrect
          })

        if (choiceError) {
          console.error(`Error creating choice ${i + 1}:`, choiceError)
          throw new Error(`Failed to create choice ${String.fromCharCode(65 + i)}: ${choiceError.message}`)
        }
      }

      // Delete existing question-LO mappings if editing
      if (editingQuestionId) {
        const { error: deleteError } = await supabase
          .from('question_lo')
          .delete()
          .eq('question_id', questionId)

        if (deleteError) {
          console.error('Error deleting existing question-LO mappings:', deleteError)
          throw new Error(`Failed to delete existing mappings: ${deleteError.message}`)
        }
      }

      // Create new question-LO mappings
      for (const loId of form.selectedLos) {
        const { error: mappingError } = await supabase
          .from('question_lo')
          .insert({
            id: uuidv4(),
            question_id: questionId,
            lo_id: loId
          })

        if (mappingError) {
          console.error('Error creating question-LO mapping:', mappingError)
          throw new Error(`Failed to create mapping for learning objective: ${mappingError.message}`)
        }
      }

      // Reset form and close popup
      setForm({
        content: '',
        options: ['', '', '', ''],
        answer: '',
        explanation: '',
        difficulty: 1,
        selectedLos: []
      })
      setEditingQuestionId(null)
      setIsPopupOpen(false)

      // Refresh questions list
      const { data: updatedQuestions, error: fetchError } = await supabase
        .from('questions')
        .select('*')
        .eq('created_by', currentUserId)

      if (fetchError) {
        console.error('Error fetching updated questions:', fetchError)
      } else if (updatedQuestions) {
        setQuestions(updatedQuestions)
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
      const selectedCourseData = courses.find(c => c.id === selectedCourse);
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
        content: data.question,
        options: options,
        answer: letterAnswer,
        explanation: data.explanation || '',
        difficulty: form.difficulty
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
                    setSelectedCourse(e.target.value)
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
                      setSelectedChapter(e.target.value)
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
                No questions added yet
              </div>
            ) : (
              <div className="space-y-4">
                {questions
                  .filter(question => {
                    if (!selectedLO) return true;
                    const mappedQuestionLOs = questionLOs.filter((qlo: QuestionLO) => qlo.question_id === question.id);
                    return mappedQuestionLOs.some((qlo: QuestionLO) => qlo.lo_id === selectedLO);
                  })
                  .map(question => {
                    const mappedQuestionLOs = questionLOs.filter((qlo: QuestionLO) => qlo.question_id === question.id)
                    const mappedLOs = mappedQuestionLOs.map((qlo: QuestionLO) => 
                      learningObjectives.find(lo => lo.id === qlo.lo_id)
                    ).filter(Boolean) as LearningObjective[]

                    return (
                      <div key={question.id} className="border rounded p-4 hover:bg-gray-50">
                        <div className="font-semibold mb-2">{question.content}</div>
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
                            onClick={() => handleEditQuestion(question)}
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
                    onChange={(e) => setForm({ ...form, difficulty: parseInt(e.target.value) })}
                    className="border rounded px-3 py-2"
                    disabled={isLoading}
                  >
                    <option value={1}>Easy</option>
                    <option value={2}>Medium</option>
                    <option value={3}>Hard</option>
                  </select>
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
                        content: '',
                        options: ['', '', '', ''],
                        answer: '',
                        explanation: '',
                        difficulty: 1,
                        selectedLos: []
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
                      setSelectedCourse(e.target.value)
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
                        setSelectedChapter(e.target.value)
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
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
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
                        checked={form.answer === String.fromCharCode(65 + index)}
                        onChange={() => setForm({ ...form, answer: String.fromCharCode(65 + index) })}
                        className="h-4 w-4"
                        disabled={isLoading}
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => handleChoiceChange(index, 'options', e.target.value)}
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
                        content: '',
                        options: ['', '', '', ''],
                        answer: '',
                        explanation: '',
                        difficulty: 1,
                        selectedLos: []
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
