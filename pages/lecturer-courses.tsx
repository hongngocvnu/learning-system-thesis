import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import Header from '../components/Header'

interface Course {
  id: string
  name: string
  code: string
  description: string
  lecturer_id: string
  created_at: string
}

export default function LecturerCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [form, setForm] = useState({ name: '', code: '', description: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchCourses()
  }, [])

  const fetchCourses = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('courses')
      .select('*')
      .eq('lecturer_id', user.id)
      .order('created_at', { ascending: false })
    
    if (data) setCourses(data)
  }

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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

      if (!error) {
        setCourses(courses.map(course => 
          course.id === editingId 
            ? { ...course, ...form }
            : course
        ))
      }
    } else {
      const newCourse = {
        id: uuidv4(),
        ...form,
        lecturer_id: user.id,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('courses')
        .insert([newCourse])
        .select()

      if (!error && data) {
        setCourses([...courses, data[0]])
      }
    }

    resetForm()
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

  const handleDelete = async (id: string) => {
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-[#0f2a4e]">Manage Courses</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
          >
            Add New Course
          </button>
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
              <div className="flex space-x-2">
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
