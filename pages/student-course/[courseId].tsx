import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/router'
import Header from '../../components/Header'
import Link from 'next/link'

interface Course {
  id: string
  name: string
  code: string
  description: string
  lecturer_id: string
}

interface Chapter {
  id: string
  title: string
  order_num: number
  content: string
}

interface LearningObjective {
  id: string
  title: string
  description: string
  lo_code: string
  chapter_id: string
}

interface Lecturer {
  id: string
  email: string
  name: string
}

export default function StudentCourse() {
  const router = useRouter()
  const { courseId } = router.query
  const [course, setCourse] = useState<Course | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([])
  const [lecturer, setLecturer] = useState<Lecturer | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (router.isReady && courseId) {
      fetchCourseData()
    }
  }, [router.isReady, courseId])

  const fetchCourseData = async () => {
    if (!courseId || typeof courseId !== 'string') return

    try {
      setIsLoading(true)

      // Fetch course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (courseError) throw courseError
      setCourse(courseData)

      // Fetch lecturer details
      if (courseData.lecturer_id) {
        const { data: lecturerData, error: lecturerError } = await supabase
          .from('users')
          .select('*')
          .eq('id', courseData.lecturer_id)
          .single()

        if (lecturerError) throw lecturerError
        setLecturer(lecturerData)
      }

      // Fetch chapters
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', courseId)
        .order('order_num', { ascending: true })

      if (chaptersError) throw chaptersError
      setChapters(chaptersData || [])

      // Fetch learning objectives for all chapters
      const chapterIds = chaptersData?.map(chapter => chapter.id) || []
      if (chapterIds.length > 0) {
        const { data: losData, error: losError } = await supabase
          .from('learning_objectives')
          .select('*')
          .in('chapter_id', chapterIds)
          .order('lo_code', { ascending: true })

        if (losError) throw losError
        setLearningObjectives(losData || [])
      }
    } catch (error) {
      console.error('Error fetching course data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleTakeTest = () => {
    if (courseId) {
      router.push(`/student-test/${courseId}`)
    }
  }

  const handleChapterClick = (chapterId: string) => {
    setSelectedChapter(selectedChapter === chapterId ? null : chapterId)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-red-500">Course not found</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/dashboard-student" 
            className="text-[#0f2a4e] hover:text-blue-800 flex items-center"
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 mr-2" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" 
                clipRule="evenodd" 
              />
            </svg>
            Back to Dashboard
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-[#0f2a4e] mb-2">
            {course.code} - {course.name}
          </h1>
          <p className="text-gray-600 mb-4">{course.description}</p>
          
          {lecturer && (
            <div className="mb-4">
              <p className="text-sm text-gray-500">
                Created by: <span className="text-[#0f2a4e] font-medium">{lecturer.name}</span> ({lecturer.email})
              </p>
            </div>
          )}
          
          <button
            onClick={handleTakeTest}
            className="bg-[#0f2a4e] text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition-colors shadow-sm"
          >
            Take Course Test
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-[#0f2a4e] mb-4">Chapters</h2>
            <div className="space-y-4">
              {chapters.map((chapter) => (
                <div 
                  key={chapter.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleChapterClick(chapter.id)}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-[#0f2a4e]">
                      Chapter {chapter.order_num}: {chapter.title}
                    </h3>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      className={`h-5 w-5 text-gray-400 transform transition-transform ${
                        selectedChapter === chapter.id ? 'rotate-180' : ''
                      }`} 
                      viewBox="0 0 20 20" 
                      fill="currentColor"
                    >
                      <path 
                        fillRule="evenodd" 
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" 
                        clipRule="evenodd" 
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600 mt-2">{chapter.content}</p>
                  
                  {selectedChapter === chapter.id && (
                    <div className="mt-4 pl-4 border-l-2 border-[#0f2a4e]">
                      <h4 className="text-sm font-medium text-[#0f2a4e] mb-2">Learning Objectives:</h4>
                      <div className="space-y-2">
                        {learningObjectives
                          .filter(lo => lo.chapter_id === chapter.id)
                          .map(lo => (
                            <div key={lo.id} className="text-sm text-gray-600">
                              <span className="font-medium text-[#0f2a4e]">{lo.lo_code}:</span> {lo.title}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-[#0f2a4e] mb-4">Course Overview</h2>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-[#0f2a4e] mb-2">Total Chapters</h3>
                <p className="text-3xl font-bold text-[#0f2a4e]">{chapters.length}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-[#0f2a4e] mb-2">Total Learning Objectives</h3>
                <p className="text-3xl font-bold text-[#0f2a4e]">{learningObjectives.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 