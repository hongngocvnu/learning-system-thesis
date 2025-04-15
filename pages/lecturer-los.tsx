// pages/lecturer-learning-objectives.js
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import Header from '../components/Header'
import { useRouter } from 'next/router'
import Link from 'next/link'

interface Chapter {
  id: string
  title: string
  course_id: string
}

interface LearningObjective {
  id: string
  chapter_id: string
  title: string
  description: string
  lo_code: string
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
  title: string
  description: string
  lo_code: string
  materials: {
    type: string
    url: string
  }[]
}

export default function LearningObjectiveManager() {
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([])
  const [form, setForm] = useState<FormData>({ 
    title: '', 
    description: '', 
    lo_code: '',
    materials: []
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const router = useRouter()
  const { chapterId } = router.query

  useEffect(() => {
    const fetchUserAndChapters = async () => {
      try {
        setIsLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('No user found')
          return
        }
        
        setCurrentUserId(user.id)
        
        // Fetch chapters for the current lecturer
        const { data: chaptersData, error: chaptersError } = await supabase
          .from('chapters')
          .select('id, title, course_id')
          .eq('created_by', user.id)
          .order('order_num', { ascending: true })

        if (chaptersError) {
          console.error('Error fetching chapters:', chaptersError)
          return
        }

        if (chaptersData) {
          setChapters(chaptersData)
          // If chapterId is provided in URL, select that chapter
          if (chapterId && typeof chapterId === 'string') {
            setSelectedChapterId(chapterId)
          } else if (chaptersData.length > 0) {
            setSelectedChapterId(chaptersData[0].id)
          }
        }
      } catch (error) {
        console.error('Error in fetchUserAndChapters:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserAndChapters()
  }, [chapterId])

  useEffect(() => {
    if (selectedChapterId) {
    fetchLearningObjectives()
    }
  }, [selectedChapterId])

  const fetchLearningObjectives = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('learning_objectives')
        .select('*')
        .eq('chapter_id', selectedChapterId)
        .order('lo_code', { ascending: true })

      if (error) {
        console.error('Error fetching learning objectives:', error)
        return
      }

      if (data) {
        setLearningObjectives(data)
      }
    } catch (error) {
      console.error('Error in fetchLearningObjectives:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, materialIndex: number) => {
    if (!event.target.files || !event.target.files[0]) return

    try {
      setIsUploading(true)
      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `learning-materials/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(filePath, file)

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('materials')
        .getPublicUrl(filePath)

      setForm(prev => ({
        ...prev,
        materials: prev.materials.map((material, index) => 
          index === materialIndex ? { 
            ...material, 
            type: 'pdf',
            url: publicUrl 
          } : material
        )
      }))
    } catch (error) {
      console.error('Error in handleFileUpload:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleAddMaterial = () => {
    setForm(prev => ({
      ...prev,
      materials: [...prev.materials, { 
        type: '', 
        url: '' 
      }]
    }))
  }

  const handleRemoveMaterial = (index: number) => {
    setForm(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index)
    }))
  }

  const handleMaterialChange = (index: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      materials: prev.materials.map((material, i) => 
        i === index ? { ...material, [field]: value } : material
      )
    }))
  }

  const handleSubmit = async () => {
    if (!form.title || !form.lo_code) {
      alert('Please fill in both title and LO code')
      return
    }
    if (!selectedChapterId) {
      alert('Please select a chapter')
      return
    }
    if (!currentUserId) {
      alert('User not authenticated')
      return
    }

    try {
      setIsLoading(true)
      const loId = editingId || uuidv4()

      // Insert or update learning objective
    if (editingId) {
        const { error } = await supabase
          .from('learning_objectives')
          .update({
            title: form.title,
            description: form.description,
            lo_code: form.lo_code
          })
          .eq('id', editingId)

        if (error) throw error
    } else {
        const { error } = await supabase
          .from('learning_objectives')
          .insert({
            id: loId,
            chapter_id: selectedChapterId,
            title: form.title,
            description: form.description,
            lo_code: form.lo_code
          })

        if (error) throw error
      }

      // Delete existing materials if editing
      if (editingId) {
        const { error: deleteError } = await supabase
          .from('learning_materials')
          .delete()
          .eq('lo_id', editingId)

        if (deleteError) {
          console.error('Error deleting materials:', deleteError)
          throw deleteError
        }
      }

      // Insert new materials
      const materialPromises = form.materials
        .filter(material => material.type && material.url)
        .map(material => 
          supabase
            .from('learning_materials')
            .insert({
              id: uuidv4(),
              lo_id: loId,
              type: material.type,
              url: material.url,
              uploaded_by: currentUserId
            })
        )

      const results = await Promise.all(materialPromises)
      const errors = results.filter(result => result.error)
      
      if (errors.length > 0) {
        console.error('Errors inserting materials:', errors)
        throw new Error('Failed to insert some materials')
      }

      // Reset form
      setForm({ title: '', description: '', lo_code: '', materials: [] })
      setEditingId(null)
      await fetchLearningObjectives()
      alert('Learning objective and materials saved successfully!')
    } catch (error) {
      console.error('Error in handleSubmit:', error)
      alert('An error occurred while saving the learning objective and materials')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async (lo: LearningObjective) => {
    try {
      setIsLoading(true)
      // Fetch existing materials
      const { data: materials, error } = await supabase
        .from('learning_materials')
        .select('*')
        .eq('lo_id', lo.id)

      if (error) {
        console.error('Error fetching materials:', error)
        throw error
      }

      setForm({
        title: lo.title,
        description: lo.description,
        lo_code: lo.lo_code,
        materials: materials?.map(m => ({
          type: m.type,
          url: m.url
        })) || []
      })
    setEditingId(lo.id)
    } catch (error) {
      console.error('Error in handleEdit:', error)
      alert('Error loading learning objective materials')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this learning objective?')) return

    try {
      setIsLoading(true)
      const { error } = await supabase
        .from('learning_objectives')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchLearningObjectives()
    } catch (error) {
      console.error('Error in handleDelete:', error)
      alert('An error occurred while deleting the learning objective')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && chapters.length === 0) {
    return (
      <div className="p-6">
        <Header />
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header />
      <div className="p-6">
        <div className="flex items-center mb-6">
          <Link 
            href="/lecturer-chapters" 
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
            Back to Chapters
          </Link>
        </div>
        <h1 className="text-2xl font-bold mb-4 text-[#0f2a4e]">Manage Learning Objectives</h1>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Chapter
          </label>
          <select
            className="w-full border rounded px-3 py-2"
            onChange={(e) => setSelectedChapterId(e.target.value)}
            value={selectedChapterId}
            disabled={isLoading}
          >
            <option value="">Select a chapter</option>
            {chapters.map(chapter => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.title}
              </option>
            ))}
          </select>
        </div>

        {selectedChapterId && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Learning Objective Management */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-[#0f2a4e]">
                {editingId ? 'Edit Learning Objective' : 'Add New Learning Objective'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    LO Code *
                  </label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="Enter LO code (e.g., LO1.1)"
                    value={form.lo_code}
                    onChange={e => setForm({ ...form, lo_code: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="Enter learning objective title"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2"
                    placeholder="Enter learning objective description"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    disabled={isLoading}
                  />
                </div>

                {/* Learning Materials Section */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Learning Materials
                    </label>
                    <button
                      type="button"
                      onClick={handleAddMaterial}
                      className="text-sm text-[#0f2a4e] hover:text-blue-800"
                      disabled={isLoading}
                    >
                      + Add Material
                    </button>
                  </div>
                  <div className="space-y-4">
                    {form.materials.map((material, index) => (
                      <div key={index} className="border rounded p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-sm font-medium text-gray-700">Material {index + 1}</h3>
                          <button
                            type="button"
                            onClick={() => handleRemoveMaterial(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Material Type *
                            </label>
                            <select
                              value={material.type}
                              onChange={e => handleMaterialChange(index, 'type', e.target.value)}
                              className="w-full border rounded px-3 py-2 text-sm"
                              disabled={isLoading}
                            >
                              <option value="">Select type</option>
                              <option value="pdf">PDF</option>
                              <option value="link">Link</option>
                            </select>
                          </div>
                          {material.type === 'pdf' && (
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Upload PDF
                              </label>
        <input
                                type="file"
                                accept=".pdf"
                                onChange={(e) => handleFileUpload(e, index)}
                                className="w-full text-sm"
                                disabled={isLoading || isUploading}
                              />
                              {isUploading && <div className="text-xs text-gray-500 mt-1">Uploading...</div>}
                            </div>
                          )}
                          {material.type === 'link' && (
        <input
                              type="url"
                              placeholder="Enter URL"
                              value={material.url}
                              onChange={e => handleMaterialChange(index, 'url', e.target.value)}
                              className="w-full border rounded px-3 py-2 text-sm"
                              disabled={isLoading}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  className="w-full bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800 disabled:opacity-50"
                  disabled={isLoading}
                >
                  {editingId ? 'Update Learning Objective' : 'Add Learning Objective'}
        </button>
              </div>
            </div>

            {/* Right Column - Learning Objectives List */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-[#0f2a4e]">
                Learning Objectives List
              </h2>
              {isLoading ? (
                <div className="text-center py-4">Loading learning objectives...</div>
              ) : learningObjectives.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  No learning objectives added yet
                </div>
              ) : (
      <div className="space-y-4">
                  {learningObjectives.map(lo => (
                    <div key={lo.id} className="border rounded p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-lg">
                            {lo.lo_code} - {lo.title}
                          </div>
                          {lo.description && (
                            <div className="text-gray-600 mt-2">
                              {lo.description}
                            </div>
                          )}
                        </div>
                        <div className="space-x-2">
                          <button
                            onClick={() => handleEdit(lo)}
                            className="text-blue-600 hover:text-blue-800"
                            disabled={isLoading}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(lo.id)}
                            className="text-red-600 hover:text-red-800"
                            disabled={isLoading}
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
        )}
      </div>
    </div>
  )
}
