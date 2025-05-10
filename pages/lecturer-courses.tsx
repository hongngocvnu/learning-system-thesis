import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'

interface Course {
  id: number
  name: string
  code: string
  description: string
  lecturer_id: number
  created_at: string
}

interface Chapter {
  id: number
  course_id: number
  title: string
  order_num: number
  created_by: number
  created_at: string
}

export default function LecturerCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [form, setForm] = useState({ name: '', code: '', description: '' })
  const [chapterForm, setChapterForm] = useState({ title: '', order_num: 1, course_id: 0 })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showChapterForm, setShowChapterForm] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    if (selectedCourse) {
      fetchChapters(selectedCourse)
    } else {
      setChapters([])
    }
  }, [selectedCourse])

  const fetchCourses = async () => {
    try {
      // Get user ID from session storage
      const userId = sessionStorage.getItem('userId')
      if (!userId) {
        console.error('No user ID found in session storage')
        return
      }

      console.log('Fetching courses for lecturer:', userId)

      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('lecturer_id', parseInt(userId))
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching courses:', error)
        return
      }

      console.log('Fetched courses:', data)
      setCourses(data || [])
    } catch (error) {
      console.error('Error in fetchCourses:', error)
    }
  }

  const fetchChapters = async (courseId: number) => {
    try {
      const { data, error } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', courseId)
        .order('order_num', { ascending: true })

      if (error) {
        console.error('Error fetching chapters:', error)
        return
      }

      setChapters(data || [])
    } catch (error) {
      console.error('Error in fetchChapters:', error)
    }
  }

  const handleSubmit = async () => {
    try {
      const userId = sessionStorage.getItem('userId')
      if (!userId) {
        alert('Error: User ID not found')
        return
      }

      if (!form.name || !form.code) {
        alert('Please fill in all required fields')
        return
      }

      if (editingId) {
        const { error } = await supabase
          .from('courses')
          .update({
            name: form.name,
            code: form.code,
            description: form.description
          })
          .eq('id', editingId)

        if (error) {
          console.error('Error updating course:', error)
          alert(`Error updating course: ${error.message}`)
          return
        }

        setCourses(courses.map(course => 
          course.id === editingId 
            ? { ...course, ...form }
            : course
        ))
        alert('Course updated successfully!')
      } else {
        const newCourse = {
          name: form.name,
          code: form.code,
          description: form.description,
          lecturer_id: parseInt(userId)
        }

        const { data, error } = await supabase
          .from('courses')
          .insert([newCourse])
          .select()

        if (error) {
          console.error('Error creating course:', error)
          alert(`Error creating course: ${error.message}`)
          return
        }

        if (!data || data.length === 0) {
          console.error('No data returned after course creation')
          alert('Error: Course was not created successfully')
          return
        }

        setCourses([...courses, data[0]])
        alert('Course created successfully!')
      }

      resetForm()
    } catch (error: any) {
      console.error('Error in handleSubmit:', error)
      alert(`An unexpected error occurred: ${error.message}`)
    }
  }

  const handleChapterSubmit = async () => {
    try {
      const userId = sessionStorage.getItem('userId')
      if (!userId) {
        alert('Error: User ID not found')
        return
      }

      if (!chapterForm.title || !chapterForm.course_id) {
        alert('Please fill in all required fields')
        return
      }

      const newChapter = {
        title: chapterForm.title,
        order_num: chapterForm.order_num,
        course_id: chapterForm.course_id,
        created_by: parseInt(userId)
      }

      const { data, error } = await supabase
        .from('chapters')
        .insert([newChapter])
        .select()

      if (error) {
        console.error('Error creating chapter:', error)
        alert(`Error creating chapter: ${error.message}`)
        return
      }

      if (!data || data.length === 0) {
        console.error('No data returned after chapter creation')
        alert('Error: Chapter was not created successfully')
        return
      }

      setChapters([...chapters, data[0]])
      alert('Chapter created successfully!')
      resetChapterForm()
    } catch (error: any) {
      console.error('Error in handleChapterSubmit:', error)
      alert(`An unexpected error occurred: ${error.message}`)
    }
  }

  const handleEdit = (course: Course) => {
    setForm({
      name: course.name,
      code: course.code,
      description: course.description
    })
    setEditingId(course.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this course?')) return

    const { error } = await supabase
      .from('courses')
      .delete()
      .eq('id', id)

    if (!error) {
      setCourses(courses.filter(course => course.id !== id))
    }
  }

  const resetForm = () => {
    setForm({ name: '', code: '', description: '' })
    setEditingId(null)
    setShowForm(false)
  }

  const resetChapterForm = () => {
    setChapterForm({ title: '', order_num: 1, course_id: 0 })
    setShowChapterForm(false)
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-[#0f2a4e]">Manage Courses</h1>
          <div className="space-x-4">
            <button
              onClick={() => setShowChapterForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Add New Chapter
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
            >
              Add New Course
            </button>
          </div>
        </div>

        {/* Course Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">
                {editingId ? 'Edit Course' : 'Add New Course'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Enter course name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })}
                    placeholder="Enter course code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Enter course description"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
                  >
                    {editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chapter Form Modal */}
        {showChapterForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Add New Chapter</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Course *
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={chapterForm.course_id}
                    onChange={e => setChapterForm({ ...chapterForm, course_id: parseInt(e.target.value) })}
                  >
                    <option value={0}>Select a course</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chapter Title *
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={chapterForm.title}
                    onChange={e => setChapterForm({ ...chapterForm, title: e.target.value })}
                    placeholder="Enter chapter title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Number *
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border rounded px-3 py-2"
                    value={chapterForm.order_num}
                    onChange={e => setChapterForm({ ...chapterForm, order_num: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={resetChapterForm}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChapterSubmit}
                    className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
                  >
                    Create Chapter
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Courses Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map(course => (
            <div key={course.id} className="bg-white shadow rounded-lg p-6">
              <h3 className="text-xl font-semibold text-[#0f2a4e] mb-2">
                {course.name}
              </h3>
              <p className="text-gray-600 font-medium mb-2">
                Code: {course.code}
              </p>
              {course.description && (
                <p className="text-gray-600 mb-4">
                  {course.description}
                </p>
              )}
              <div className="mt-4">
                <h4 className="font-medium text-gray-700 mb-2">Chapters:</h4>
                {chapters
                  .filter(chapter => chapter.course_id === course.id)
                  .map(chapter => (
                    <div key={chapter.id} className="text-sm text-gray-600 mb-1">
                      {chapter.order_num}. {chapter.title}
                    </div>
                  ))}
              </div>
              <div className="flex space-x-2 mt-4">
                <button
                  onClick={() => handleEdit(course)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(course.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
