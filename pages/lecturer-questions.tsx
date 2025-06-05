// pages/lecturer-questions.js
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { GoogleGenerativeAI } from "@google/generative-ai"
import { toast } from 'react-hot-toast'

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
}

// const genAI = new GoogleGenerativeAI("AIzaSyBBGFndzvMpWH8dCGbAsJAqCuKogSCeI8A")

// Add fetchQuestions function before the QuestionManager component
const fetchQuestions = async (userId: string, loId: number) => {
  try {
    // Lấy ID số từ bảng users dựa vào email của user hiện tại
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      throw new Error('Không tìm thấy thông tin người dùng');
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email)
      .single();

    if (userError || !userData) {
      throw new Error('Không thể lấy thông tin người dùng');
    }

    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('created_by', userData.id) // Sử dụng ID số từ bảng users

    if (questionsError) {
      console.error('Error fetching questions:', questionsError)
      return
    }

    if (questionsData) {
      // Get all question-LO mappings for the selected LO
      const { data: questionLOsData } = await supabase
        .from('question_lo')
        .select('*')
        .eq('lo_id', loId)

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

      return { questions: filteredQuestions, questionLOs: questionLOsData || [] }
    }
  } catch (error) {
    console.error('Error in fetchQuestions:', error)
    throw error
  }
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
    difficulty: 1.0
  })
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const questionsPerPage = 5
  const router = useRouter()
  const [showAddPopup, setShowAddPopup] = useState(false)

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
    const loadQuestions = async () => {
      if (!selectedLO || !currentUserId) return

      try {
        setIsLoading(true)
        const result = await fetchQuestions(currentUserId, selectedLO)
        if (result) {
          setQuestions(result.questions)
          setQuestionLOs(result.questionLOs)
        }
      } catch (error) {
        console.error('Error loading questions:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadQuestions()
  }, [selectedLO, currentUserId])

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
      difficulty: question.difficulty
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) {
      toast.error('Vui lòng đăng nhập lại để tạo câu hỏi.');
      return;
    }

    try {
      // Lấy ID số từ bảng users dựa vào email của user hiện tại
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        throw new Error('Không tìm thấy thông tin người dùng');
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single();

      if (userError || !userData) {
        throw new Error('Không thể lấy thông tin người dùng');
      }

      // Lấy ID lớn nhất hiện tại từ bảng questions
      const { data: maxIdData, error: maxIdError } = await supabase
        .from('questions')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)
        .single();

      if (maxIdError && maxIdError.code !== 'PGRST116') { // PGRST116 là lỗi khi không tìm thấy bản ghi
        console.error('Error getting max ID:', maxIdError);
        throw new Error('Không thể lấy ID cho câu hỏi mới');
      }

      const nextId = (maxIdData?.id || 0) + 1;

      const questionData = {
        id: nextId, // Thêm ID vào dữ liệu
        question_rich_text: form.question_rich_text,
        explanation: form.explanation,
        difficulty: form.difficulty,
        created_by: userData.id,
        concept_weight: null,
        time_decay_factor: null
      };

      console.log('Creating question with data:', questionData);

      // Insert the question
      const { error: insertError } = await supabase
        .from('questions')
        .insert([questionData]);

      if (insertError) {
        console.error('Error inserting question:', insertError);
        throw new Error(`Không thể tạo câu hỏi: ${insertError.message}`);
      }

      const questionId = nextId;
      console.log('Successfully created question with ID:', questionId);

      // Delete existing choices if editing
      if (editingQuestionId) {
        const { error: deleteError } = await supabase
          .from('choices')
          .delete()
          .eq('question_id', questionId)

        if (deleteError) {
          console.error('Error deleting existing choices:', deleteError)
          throw new Error(`Không thể xóa các lựa chọn cũ: ${deleteError.message}`)
        }
      }

      // Insert new choices
      const choices = form.options.map((option, index) => ({
        question_id: questionId,
        choice: option,
        is_correct: index === form.correctAnswerIndex
      }))

      const { error: choicesError } = await supabase
        .from('choices')
        .insert(choices)

      if (choicesError) {
        console.error('Error saving choices:', choicesError)
        throw new Error(`Không thể lưu các lựa chọn: ${choicesError.message}`)
      }

      // Delete existing question-LO mappings if editing
      if (editingQuestionId) {
        const { error: deleteError } = await supabase
          .from('question_lo')
          .delete()
          .eq('question_id', questionId)

        if (deleteError) {
          console.error('Error deleting existing question-LO mappings:', deleteError)
          throw new Error(`Không thể xóa liên kết LO cũ: ${deleteError.message}`)
        }
      }

      // Insert new question-LO mappings
      const questionLOs = form.selectedLos.map(loId => ({
        question_id: questionId,
        lo_id: loId
      }))

      const { error: questionLOError } = await supabase
        .from('question_lo')
        .insert(questionLOs)

      if (questionLOError) {
        console.error('Error saving question-LO mappings:', questionLOError)
        throw new Error(`Không thể lưu liên kết LO: ${questionLOError.message}`)
      }

      // Reset form and refresh questions
      resetForm()
      
      // Fetch updated questions
      if (selectedLO) {
        const result = await fetchQuestions(currentUserId, selectedLO)
        if (result) {
          setQuestions(result.questions)
          setQuestionLOs(result.questionLOs)
        }
      }

      // Show success message and close popup
      toast.success(editingQuestionId ? 'Cập nhật câu hỏi thành công!' : 'Tạo câu hỏi thành công!')
      setShowAddPopup(false) // Close the popup
      
      // Log success message
      console.log('Question saved successfully:', {
        questionId: nextId,
        isEdit: !!editingQuestionId,
        courseId: selectedCourse,
        chapterId: selectedChapter,
        loIds: form.selectedLos
      });

    } catch (error) {
      console.error('Error in handleSubmit:', error);
      toast.error(error instanceof Error ? error.message : 'Không thể tạo câu hỏi');
    }
  }

  const generateQuestion = async () => {
    if (!selectedCourse || !selectedChapter || form.selectedLos.length === 0) {
      toast.error('Please select a course, chapter, and at least one learning objective first')
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

      // Construct the prompt for Gemini
      const prompt = `Generate a multiple choice question for the following learning objective:
Course: ${selectedCourseData.name}
Chapter: ${selectedChapterData.title}
Learning Objective: ${selectedLOData.title}
Difficulty Level: ${form.difficulty === 1 ? 'Easy' : form.difficulty === 2 ? 'Medium' : 'Hard'}

Please provide the response in the following JSON format:
{
  "question": "The question text",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": "The correct option text",
  "explanation": "Explanation of why this is the correct answer"
}

Make sure the question is clear, relevant to the learning objective, and appropriate for the specified difficulty level.`;

      // Add retry mechanism
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds

      while (retryCount < maxRetries) {
        try {
          // Generate content using the Gemini model
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const responseText = response.text();

          if (!responseText) {
            throw new Error('No response from Gemini API');
          }

          // Parse the JSON response from the text
          let parsedResponse;
          try {
            // Clean the response text and find JSON content
            const cleanedText = responseText.replace(/```json\s*|\s*```/g, '').trim();
            
            // Try to find JSON content within the response text
            let jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
              // If no JSON found, try parsing the entire cleaned text
              jsonMatch = [cleanedText];
            }
            
            // Clean up common JSON formatting issues
            let jsonString = jsonMatch[0]
              .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
              .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
              .replace(/[\u201C\u201D]/g, '"')  // Replace smart quotes with regular quotes
              .replace(/[\u2018\u2019]/g, "'");  // Replace smart apostrophes
            
            parsedResponse = JSON.parse(jsonString);
          } catch (error) {
            console.error('Error parsing Gemini response:', error);
            console.error('Response text:', responseText);
            throw new Error('Failed to parse question data from response. Please try again or create the question manually.');
          }

          if (!parsedResponse.question || !parsedResponse.options || !parsedResponse.answer) {
            throw new Error('Invalid question data format');
          }

          // Find the index of the correct answer in the options array
          let answerIndex = parsedResponse.options.findIndex((option: string) => 
            option.toLowerCase().trim() === parsedResponse.answer.toLowerCase().trim()
          );

          // If exact match fails, try partial matching
          if (answerIndex === -1) {
            answerIndex = parsedResponse.options.findIndex((option: string) => 
              option.toLowerCase().includes(parsedResponse.answer.toLowerCase()) ||
              parsedResponse.answer.toLowerCase().includes(option.toLowerCase())
            );
          }

          // If still no match, default to first option and warn user
          if (answerIndex === -1) {
            console.warn('Could not match correct answer, defaulting to first option');
            answerIndex = 0;
          }
          
          // Update form with generated data
          setForm({
            ...form,
            question_rich_text: parsedResponse.question,
            options: parsedResponse.options,
            correctAnswerIndex: answerIndex,
            explanation: parsedResponse.explanation || '',
            difficulty: form.difficulty
          });

          toast.success('Question generated successfully!');
          return; // Success, exit the function

        } catch (error: any) {
          if (error.message.includes('503') && retryCount < maxRetries - 1) {
            retryCount++;
            toast.error(`Attempt ${retryCount} failed. Retrying in ${retryDelay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          throw error; // Re-throw if not a 503 error or max retries reached
        }
      }

      // If we get here, all retries failed
      throw new Error('Failed to generate question after multiple attempts. Please try again later.');

    } catch (error) {
      console.error('Error generating question:', error);
      if (error instanceof Error) {
        if (error.message.includes('503')) {
          toast.error('The AI service is currently overloaded. Please try again in a few moments.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('Failed to generate question. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Add this to reset pagination when chapter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedChapter])

  const resetForm = () => {
    setForm({
      question_rich_text: '',
      explanation: '',
      options: ['', ''],
      correctAnswerIndex: 0,
      selectedLos: [],
      difficulty: 1.0
    })
    setEditingQuestionId(null)
    setIsPopupOpen(false)
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
            onClick={() => setShowAddPopup(true)}
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

        {/* Add New Question Popup */}
        {showAddPopup && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowAddPopup(false)}></div>
            <div className="relative min-h-screen flex items-center justify-center p-4">
              <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full">
                <div className="flex justify-between items-center p-6 border-b">
                  <h3 className="text-xl font-semibold text-[#0f2a4e]">Add New Question</h3>
                  <button
                    onClick={() => setShowAddPopup(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-[#0f2a4e]">
                      {editingQuestionId ? 'Edit Question' : 'Add New Question'}
                    </h2>
                    <div className="flex space-x-2">
                      <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Difficulty:</label>
                        <select
                          value={form.difficulty}
                          onChange={(e) => setForm({ ...form, difficulty: Number(e.target.value) })}
                          className="border rounded px-2 py-1"
                          disabled={isLoading}
                        >
                          <option value={1}>Easy</option>
                          <option value={2}>Medium</option>
                          <option value={3}>Hard</option>
                        </select>
                      </div>
                      <button
                        onClick={generateQuestion}
                        className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-[#0f2a4e] disabled:opacity-50"
                        disabled={isLoading || !selectedCourse || !selectedChapter || form.selectedLos.length === 0}
                      >
                        Auto Generate
                      </button>
                      <button
                        onClick={() => {
                          setShowAddPopup(false)
                          setEditingQuestionId(null)
                          resetForm()
                        }}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {/* <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg> */}
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
                          setShowAddPopup(false)
                          setEditingQuestionId(null)
                          resetForm()
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
