import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import Link from 'next/link'

interface Chapter {
  id: string
  course_id: string
  title: string
  order_num: number
  created_by: string
}

interface Course {
  id: string
  name: string
  code: string
  description: string
  lecturer_id: string
  created_at: string
}

export default function LecturerChapters() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPopupOpen, setIsPopupOpen] = useState(false)
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null)
  const [form, setForm] = useState({
    title: '',
    order_num: 1
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('No user found')
          return
        }

        // Fetch courses for the current lecturer
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
        console.error('Error in fetchData:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Fetch chapters when course is selected
  useEffect(() => {
    const fetchChapters = async () => {
      if (!selectedCourse) {
        setChapters([])
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

  const handleEdit = (chapter: Chapter) => {
    setEditingChapter(chapter)
    setForm({
      title: chapter.title,
      order_num: chapter.order_num
    })
    setIsPopupOpen(true)
  }

  const handleDelete = async (chapterId: string) => {
    if (!confirm('Are you sure you want to delete this chapter?')) return

    try {
      setIsLoading(true)
      const { error } = await supabase
        .from('chapters')
        .delete()
        .eq('id', chapterId)

      if (error) throw error

      // Refresh chapters list
      const { data: newChapters } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', selectedCourse)
        .order('order_num', { ascending: true })

      if (newChapters) {
        setChapters(newChapters as Chapter[])
      }
    } catch (error) {
      console.error('Error in handleDelete:', error)
      alert('An error occurred while deleting the chapter')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.title || !selectedCourse) {
      alert('Please fill in all required fields')
      return
    }

    try {
      setIsLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        return
      }

      if (editingChapter) {
        // Update existing chapter
        const { error } = await supabase
          .from('chapters')
          .update({
            title: form.title,
            order_num: form.order_num
          })
          .eq('id', editingChapter.id)

        if (error) throw error
      } else {
        // Insert new chapter
        const { error } = await supabase
          .from('chapters')
          .insert({
            id: crypto.randomUUID(),
            course_id: selectedCourse,
            title: form.title,
            order_num: form.order_num,
            created_by: user.id
          })

        if (error) throw error
      }

      // Refresh chapters list
      const { data: newChapters } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', selectedCourse)
        .order('order_num', { ascending: true })

      if (newChapters) {
        setChapters(newChapters as Chapter[])
      }

      // Reset form and close popup
      setForm({
        title: '',
        order_num: 1
      })
      setEditingChapter(null)
      setIsPopupOpen(false)
    } catch (error) {
      console.error('Error in handleSubmit:', error)
      alert('An error occurred while saving the chapter')
    } finally {
      setIsLoading(false)
    }
  }

  const selectedCourseDetails = courses.find(course => course.id === selectedCourse)

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
          {selectedCourse && (
            <button
              onClick={() => setIsPopupOpen(true)}
              className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
            >
              Add New Chapter
            </button>
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Course
          </label>
          <select
            className="w-full md:w-1/3 border rounded px-3 py-2"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
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
          <h1 className="text-2xl font-bold mb-4 text-[#0f2a4e]">
            {selectedCourseDetails ? `${selectedCourseDetails.code} - ${selectedCourseDetails.name}` : 'Loading...'}
          </h1>
        )}

        {isLoading ? (
          <div className="text-center py-4">Loading...</div>
        ) : selectedCourse ? (
          chapters.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No chapters added yet
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {chapters.map(chapter => (
                <div key={chapter.id} className="bg-white shadow rounded-lg p-6">
                  <div className="font-semibold text-lg mb-2">
                    Chapter {chapter.order_num}: {chapter.title}
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleEdit(chapter)}
                      className="text-blue-600 hover:text-blue-800"
                      disabled={isLoading}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(chapter.id)}
                      className="text-red-600 hover:text-red-800"
                      disabled={isLoading}
                    >
                      Delete
                    </button>
                    <Link
                      href={`/lecturer-los?chapterId=${chapter.id}`}
                      className="text-green-600 hover:text-green-800"
                    >
                      LO
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-4 text-gray-500">
            Please select a course to view its chapters
          </div>
        )}

        {/* Add/Edit Chapter Popup */}
        {isPopupOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center overflow-y-auto py-8">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-[#0f2a4e]">Add New Chapter</h2>
                <button
                  onClick={() => setIsPopupOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chapter Title *
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Number *
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded px-3 py-2"
                    value={form.order_num}
                    onChange={(e) => setForm({ ...form, order_num: parseInt(e.target.value) })}
                    min="1"
                    disabled={isLoading}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setIsPopupOpen(false)}
                    className="px-4 py-2 border rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800 disabled:opacity-50"
                    disabled={isLoading}
                  >
                    Add Chapter
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
