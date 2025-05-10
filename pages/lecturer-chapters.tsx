import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import Link from 'next/link'

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

export default function LecturerChapters() {
  const [courses, setCourses] = useState<Course[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null)
  const [form, setForm] = useState({ title: '', order_num: 1 })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchCourses()
    // Retrieve selected course from sessionStorage
    const savedCourseId = sessionStorage.getItem('selectedCourseId')
    if (savedCourseId) {
      setSelectedCourse(parseInt(savedCourseId))
    }
  }, [])

  useEffect(() => {
    if (selectedCourse) {
      fetchChapters(selectedCourse)
      // Save selected course to sessionStorage
      sessionStorage.setItem('selectedCourseId', selectedCourse.toString())
    } else {
      setChapters([])
    }
  }, [selectedCourse])

  const fetchCourses = async () => {
    try {
      const userId = sessionStorage.getItem('userId')
      if (!userId) {
        console.error('No user ID found in session storage')
        return
      }

      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('lecturer_id', parseInt(userId))
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching courses:', error)
        return
      }

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
      if (!form.title || !selectedCourse) {
        alert('Please fill in all required fields')
        return
      }

      const userId = sessionStorage.getItem('userId')
      if (!userId) {
        alert('Error: User ID not found')
        return
      }

      if (editingId) {
        const { error } = await supabase
          .from('chapters')
          .update({
            title: form.title,
            order_num: form.order_num
          })
          .eq('id', editingId)

        if (error) {
          console.error('Error updating chapter:', error)
          alert(`Error updating chapter: ${error.message}`)
          return
        }

        setChapters(chapters.map(chapter => 
          chapter.id === editingId 
            ? { ...chapter, ...form }
            : chapter
        ))
        alert('Chapter updated successfully!')
      } else {
        const newChapter = {
          title: form.title,
          order_num: form.order_num,
          course_id: selectedCourse,
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
      }

      resetForm()
    } catch (error: any) {
      console.error('Error in handleSubmit:', error)
      alert(`An unexpected error occurred: ${error.message}`)
    }
  }

  const handleEdit = (chapter: Chapter) => {
    setForm({
      title: chapter.title,
      order_num: chapter.order_num
    })
    setEditingId(chapter.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this chapter?')) return

    const { error } = await supabase
      .from('chapters')
      .delete()
      .eq('id', id)

    if (!error) {
      setChapters(chapters.filter(chapter => chapter.id !== id))
    }
  }

  const resetForm = () => {
    setForm({ title: '', order_num: 1 })
    setEditingId(null)
    setShowForm(false)
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-[#0f2a4e]">Manage Chapters</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
          >
            Add New Chapter
          </button>
        </div>

        {/* Course Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Course
          </label>
          <select
            className="w-full max-w-md border rounded px-3 py-2"
            value={selectedCourse || ''}
            onChange={(e) => setSelectedCourse(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">Select a course</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>
                {course.code} - {course.name}
              </option>
            ))}
          </select>
        </div>

        {/* Chapter Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">
                {editingId ? 'Edit Chapter' : 'Add New Chapter'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chapter Title *
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
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
                    value={form.order_num}
                    onChange={e => setForm({ ...form, order_num: parseInt(e.target.value) })}
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

        {/* Chapters List */}
        {selectedCourse ? (
          <div className="bg-white shadow rounded-lg p-6">
            {chapters.length === 0 ? (
              <p className="text-gray-500">No chapters added yet</p>
            ) : (
              <div className="space-y-4">
                {chapters.map(chapter => (
                  <div key={chapter.id} className="border rounded p-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">
                          Chapter {chapter.order_num}: {chapter.title}
                        </h3>
                      </div>
                      <div className="flex space-x-2">
                        <Link
                          href={`/lecturer-los?chapterId=${chapter.id}`}
                          className="text-green-600 hover:text-green-800"
                        >
                          LO
                        </Link>
                        <button
                          onClick={() => handleEdit(chapter)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(chapter.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-500">
            Please select a course to view its chapters
          </div>
        )}
      </div>
    </div>
  )
}
