// pages/lecturer-learning-objectives.js
import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import Header from '../components/Header'
import { useRouter } from 'next/router'
import Link from 'next/link'

interface Chapter {
  id: number
  course_id: number
  title: string
  order_num: number
  created_by: number
  created_at: string
}

interface Course {
  id: number
  name: string
  code: string
  description: string
  lecturer_id: number
  created_at: string
}

interface LearningObjective {
  id: number
  chapter_id: number
  title: string
  description: string
  lo_code: string
  mastery_threshold: number
  confidence_delta: number
  min_samples: number
  difficulty: number
  concept_weight: number
  time_decay_factor: number
  created_by: number
  created_at: string
}

interface LearningMaterial {
  id: string
  lo_id: string
  type: string
  url: string
  uploaded_by: string
  created_at: string
}

interface FormData {
  id: number
  title: string
  description: string
  lo_code: string
  mastery_threshold: number
  confidence_delta: number
  min_samples: number
  difficulty: number
  concept_weight: number
  time_decay_factor: number
  materials: {
    type: string
    url: string
  }[]
}

export default function LecturerLOs() {
  const router = useRouter()
  const { chapterId } = router.query
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([])
  const [form, setForm] = useState<FormData>({
    id: 0,
    title: '',
    description: '',
    lo_code: '',
    mastery_threshold: 0.8,
    confidence_delta: 0.1,
    min_samples: 3,
    difficulty: 1,
    concept_weight: 1.0,
    time_decay_factor: 0.1,
    materials: []
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (chapterId) {
      fetchChapterAndCourse()
      fetchLearningObjectives()
    }
  }, [chapterId])

  const fetchChapterAndCourse = async () => {
    try {
      // Fetch chapter details
      const { data: chapterData, error: chapterError } = await supabase
        .from('chapters')
        .select('*')
        .eq('id', chapterId)
        .single()

      if (chapterError) {
        console.error('Error fetching chapter:', chapterError)
        return
      }

      setChapter(chapterData)

      // Fetch course details
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', chapterData.course_id)
        .single()

      if (courseError) {
        console.error('Error fetching course:', courseError)
        return
      }

      setCourse(courseData)
    } catch (error) {
      console.error('Error in fetchChapterAndCourse:', error)
    }
  }

  const fetchLearningObjectives = async () => {
    try {
      const { data, error } = await supabase
        .from('learning_objectives')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('lo_code', { ascending: true })

      if (error) {
        console.error('Error fetching learning objectives:', error)
        return
      }

      setLearningObjectives(data || [])
    } catch (error) {
      console.error('Error in fetchLearningObjectives:', error)
    }
  }

  const handleSubmit = async () => {
    try {
      if (!form.title || !form.id) {
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
          .from('learning_objectives')
          .update({
            title: form.title,
            description: form.description,
            mastery_threshold: form.mastery_threshold,
            confidence_delta: form.confidence_delta,
            min_samples: form.min_samples,
            difficulty: form.difficulty,
            concept_weight: form.concept_weight,
            time_decay_factor: form.time_decay_factor
          })
          .eq('id', editingId)

        if (error) {
          console.error('Error updating learning objective:', error)
          alert(`Error updating learning objective: ${error.message}`)
          return
        }

        setLearningObjectives(learningObjectives.map(lo => 
          lo.id === editingId 
            ? { ...lo, ...form }
            : lo
        ))
        alert('Learning objective updated successfully!')
      } else {
        // Check if ID already exists
        const { data: existingLO, error: checkError } = await supabase
          .from('learning_objectives')
          .select('id')
          .eq('id', form.id)
          .single()

        if (existingLO) {
          alert('This ID already exists. Please choose a different ID.')
          return
        }

        // Get the chapter number
        const chapterNumber = chapter?.order_num || 1

        // Count existing LOs for this chapter to determine the LO number
        const { count, error: countError } = await supabase
          .from('learning_objectives')
          .select('*', { count: 'exact', head: true })
          .eq('chapter_id', chapterId)

        if (countError) {
          console.error('Error counting LOs:', countError)
          alert('Error: Could not determine LO number')
          return
        }

        // Generate lo_code based on chapter number and LO count
        const loNumber = (count || 0) + 1
        const loCode = `LO${chapterNumber}.${loNumber}`

        // Create new learning objective with manual ID and generated lo_code
        const { data, error } = await supabase
          .from('learning_objectives')
          .insert({
            id: form.id,
            chapter_id: parseInt(chapterId as string),
            created_by: parseInt(userId),
            title: form.title,
            description: form.description,
            lo_code: loCode,
            mastery_threshold: form.mastery_threshold,
            confidence_delta: form.confidence_delta,
            min_samples: form.min_samples,
            difficulty: form.difficulty,
            concept_weight: form.concept_weight,
            time_decay_factor: form.time_decay_factor
          })
          .select()

        if (error) {
          console.error('Error creating learning objective:', error)
          alert(`Error creating learning objective: ${error.message}`)
          return
        }

        if (!data || data.length === 0) {
          console.error('No data returned after LO creation')
          alert('Error: Learning objective was not created successfully')
          return
        }

        setLearningObjectives([...learningObjectives, data[0]])
        alert('Learning objective created successfully!')
      }

      resetForm()
    } catch (error: any) {
      console.error('Error in handleSubmit:', error)
      alert(`An unexpected error occurred: ${error.message}`)
    }
  }

  const handleEdit = (lo: LearningObjective) => {
    setForm({
      id: lo.id,
      title: lo.title,
      description: lo.description,
      lo_code: lo.lo_code,
      mastery_threshold: lo.mastery_threshold,
      confidence_delta: lo.confidence_delta,
      min_samples: lo.min_samples,
      difficulty: lo.difficulty,
      concept_weight: lo.concept_weight,
      time_decay_factor: lo.time_decay_factor,
      materials: []
    })
    setEditingId(lo.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this learning objective?')) return

    const { error } = await supabase
      .from('learning_objectives')
      .delete()
      .eq('id', id)

    if (!error) {
      setLearningObjectives(learningObjectives.filter(lo => lo.id !== id))
    }
  }

  const resetForm = () => {
    setForm({
      id: 0,
      title: '',
      description: '',
      lo_code: '',
      mastery_threshold: 0.8,
      confidence_delta: 0.1,
      min_samples: 3,
      difficulty: 1,
      concept_weight: 1.0,
      time_decay_factor: 0.1,
      materials: []
    })
    setEditingId(null)
    setShowForm(false)
  }

  if (!chapter || !course) {
    return <div>Loading...</div>
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header />
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link 
              href="/lecturer-chapters" 
              className="flex items-center text-[#0f2a4e] hover:text-blue-800 transition-colors duration-200 mb-2"
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
              Back to Chapters
            </Link>
            <h1 className="text-2xl font-bold text-[#0f2a4e]">
              Learning Objectives for {course.code} - Chapter {chapter.order_num}: {chapter.title}
            </h1>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
          >
            Add New Learning Objective
          </button>
        </div>

        {/* Learning Objective Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
              <h2 className="text-xl font-semibold mb-4">
                {editingId ? 'Edit Learning Objective' : 'Add New Learning Objective'}
              </h2>
              <div className="space-y-4">
                {!editingId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID *
                    </label>
                    <input
                      type="number"
                      className="w-full border rounded px-3 py-2"
                      value={form.id || ''}
                      onChange={e => setForm({ ...form, id: parseInt(e.target.value) || 0 })}
                      placeholder="Enter learning objective ID"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Enter learning objective title"
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
                    placeholder="Enter learning objective description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mastery Threshold
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      className="w-full border rounded px-3 py-2"
                      value={form.mastery_threshold}
                      onChange={e => setForm({ ...form, mastery_threshold: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confidence Delta
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      className="w-full border rounded px-3 py-2"
                      value={form.confidence_delta}
                      onChange={e => setForm({ ...form, confidence_delta: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Min Samples
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full border rounded px-3 py-2"
                      value={form.min_samples}
                      onChange={e => setForm({ ...form, min_samples: parseInt(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Difficulty
                    </label>
                    <select
                      className="w-full border rounded px-3 py-2"
                      value={form.difficulty}
                      onChange={e => setForm({ ...form, difficulty: parseInt(e.target.value) })}
                    >
                      <option value={1}>Easy</option>
                      <option value={2}>Medium</option>
                      <option value={3}>Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Concept Weight
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      max="5"
                      step="0.1"
                      className="w-full border rounded px-3 py-2"
                      value={form.concept_weight}
                      onChange={e => setForm({ ...form, concept_weight: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time Decay Factor
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max="0.5"
                      step="0.01"
                      className="w-full border rounded px-3 py-2"
                      value={form.time_decay_factor}
                      onChange={e => setForm({ ...form, time_decay_factor: parseFloat(e.target.value) })}
                    />
                  </div>
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

        {/* Learning Objectives List */}
        <div className="bg-white shadow rounded-lg p-6">
          {learningObjectives.length === 0 ? (
            <p className="text-gray-500">No learning objectives added yet</p>
          ) : (
            <div className="space-y-4">
              {learningObjectives.map(lo => (
                <div key={lo.id} className="border rounded p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {lo.lo_code}: {lo.title}
                      </h3>
                      {lo.description && (
                        <p className="text-gray-600 mt-1">{lo.description}</p>
                      )}
                      <div className="mt-2 text-sm text-gray-500">
                        <p>Mastery Threshold: {lo.mastery_threshold}</p>
                        <p>Confidence Delta: {lo.confidence_delta}</p>
                        <p>Min Samples: {lo.min_samples}</p>
                        <p>Difficulty: {lo.difficulty === 1 ? 'Easy' : lo.difficulty === 2 ? 'Medium' : 'Hard'}</p>
                        <p>Concept Weight: {lo.concept_weight}</p>
                        <p>Time Decay Factor: {lo.time_decay_factor}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(lo)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(lo.id)}
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
      </div>
    </div>
  )
}
