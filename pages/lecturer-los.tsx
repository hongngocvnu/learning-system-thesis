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
  chapter_id: number
  created_by: string
  created_at: string
}

interface LearningMaterial {
  id: string
  lo_id: number
  type: string
  url: string
  uploaded_by: string
  created_at: string
  name?: string
}

interface GraphCondition {
  lo_id: number;
  threshold: number;
}

interface GraphAttributes {
  type: 'AND' | 'OR';
  conditions: GraphCondition[];
}

interface FormData {
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
  prerequisites: number[]
  graph: 'AND' | 'OR'
}

interface PrerequisiteLO {
  id: number
  title: string
  lo_code: string
}

export default function LecturerLOs() {
  const router = useRouter()
  const { chapterId } = router.query
  const [chapter, setChapter] = useState<Chapter | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([])
  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    lo_code: '',
    mastery_threshold: 0.7,
    confidence_delta: 0.15,
    min_samples: 3,
    difficulty: 1,
    concept_weight: 1.0,
    time_decay_factor: 0.1,
    materials: [],
    prerequisites: [],
    graph: 'AND'
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [availablePrerequisites, setAvailablePrerequisites] = useState<PrerequisiteLO[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [materialFiles, setMaterialFiles] = useState<LearningMaterial[]>([])
  const [allMaterials, setAllMaterials] = useState<Record<number, LearningMaterial[]>>({})
  const [selectedLoId, setSelectedLoId] = useState<number | null>(null)
  const [selectedLoMaterials, setSelectedLoMaterials] = useState<LearningMaterial[]>([])

  useEffect(() => {
    let isMounted = true

    const initialize = async () => {
      if (!chapterId) return

      try {
        console.log('Starting initialization with chapterId:', chapterId)
        const courseData = await fetchChapterAndCourse()
        
        if (!isMounted) return

        if (courseData) {
          console.log('Course data fetched, fetching LOs...')
          await Promise.all([
            fetchLearningObjectives(),
            fetchAvailablePrerequisites()
          ])
        }
      } catch (error) {
        console.error('Error during initialization:', error)
      }
    }

    initialize()

    return () => {
      isMounted = false
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
      return courseData // Return course data
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

  const fetchAvailablePrerequisites = async () => {
    if (!chapterId || !course) {
      console.log('Missing chapterId or course:', { chapterId, course })
      return
    }

    try {
      // First get all chapters in the course
      const { data: chapters, error: chaptersError } = await supabase
        .from('chapters')
        .select('id')
        .eq('course_id', course.id)

      if (chaptersError) {
        console.error('Error fetching chapters:', chaptersError)
        return
      }

      if (!chapters || chapters.length === 0) {
        console.log('No chapters found for course')
        return
      }

      // Get all LOs from all chapters in the course
      const { data: los, error: losError } = await supabase
        .from('learning_objectives')
        .select('id, lo_code, title')
        .in('chapter_id', chapters.map(c => c.id))
        .order('lo_code', { ascending: true })

      if (losError) {
        console.error('Error fetching LOs:', losError)
        return
      }

      console.log('Found LOs for prerequisites:', los)

      if (!los || los.length === 0) {
        console.log('No LOs found for any chapter')
        return
      }

      // Filter out the current LO if we're editing
      const filteredLos = editingId 
        ? los.filter(lo => lo.id !== editingId)
        : los

      setAvailablePrerequisites(filteredLos as PrerequisiteLO[])
    } catch (error) {
      console.error('Error in fetchAvailablePrerequisites:', error)
    }
  }

  const getNextAvailableId = async (): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('learning_objectives')
        .select('id')
        .order('id', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error fetching last ID:', error)
        return 1 // Default to 1 if error
      }

      // If no LOs exist yet, start with 1
      if (!data || data.length === 0) {
        return 1
      }

      // Return next ID
      return (data[0].id || 0) + 1
    } catch (error) {
      console.error('Error in getNextAvailableId:', error)
      return 1
    }
  }

  const handleSubmit = async () => {
    try {
      if (!form.title) {
        alert('Please fill in all required fields')
        return
      }

      const userId = sessionStorage.getItem('userId')
      if (!userId) {
        alert('Error: User ID not found')
        return
      }

      if (editingId) {
        // First update the LO
        const { error: updateError } = await supabase
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

        if (updateError) {
          console.error('Error updating learning objective:', updateError)
          alert(`Error updating learning objective: ${updateError.message}`)
          return
        }

        // Then update dependencies
        if (form.prerequisites && form.prerequisites.length > 0) {
          // First delete existing dependencies
          const { error: deleteError } = await supabase
            .from('lo_dependencies')
            .delete()
            .eq('dependent_lo_id', editingId)

          if (deleteError) {
            console.error('Error deleting old dependencies:', deleteError)
            alert('LO updated but failed to update dependencies')
            return
          }

          // Then insert new dependencies
          const dependencies = form.prerequisites.map(prereqId => ({
            lo_id: prereqId,
            dependent_lo_id: editingId,
            graph: form.graph
          }))

          const { error: insertError } = await supabase
            .from('lo_dependencies')
            .insert(dependencies)

          if (insertError) {
            console.error('Error creating new dependencies:', insertError)
            alert('LO updated but failed to create new dependencies')
            return
          }
        }

        // Update local state
        setLearningObjectives(learningObjectives.map(lo => 
          lo.id === editingId 
            ? { ...lo, ...form }
            : lo
        ))
        alert('Learning objective updated successfully!')
        setShowForm(false)
      } else {
        try {
          // Get next available ID
          const nextId = await getNextAvailableId()
          console.log('Next available ID:', nextId)

          // Get the chapter number
          const chapterNumber = chapter?.order_num || 1

          // Count existing LOs for this chapter
          const { count, error: countError } = await supabase
            .from('learning_objectives')
            .select('*', { count: 'exact', head: true })
            .eq('chapter_id', chapterId)

          if (countError) {
            console.error('Error counting LOs:', countError)
            alert('Error: Could not determine LO number')
            return
          }

          // Generate lo_code
          const loNumber = (count || 0) + 1
          const loCode = `LO${chapterNumber}.${loNumber}`

          // First insert the LO
          const { error: insertError } = await supabase
            .from('learning_objectives')
            .insert({
              id: nextId,
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

          if (insertError) {
            console.error('Error creating learning objective:', insertError)
            alert(`Error creating learning objective: ${insertError.message}`)
            return
          }

          // Then fetch the created LO
          const { data: createdLO, error: fetchError } = await supabase
            .from('learning_objectives')
            .select('*')
            .eq('id', nextId)
            .single()

          if (fetchError) {
            console.error('Error fetching created LO:', fetchError)
            alert('LO was created but could not be retrieved')
            return
          }

          if (!createdLO) {
            console.error('No data returned after LO creation')
            alert('Error: Learning objective was not created successfully')
            return
          }

          console.log('Created LO data:', createdLO)

          // Add the new LO to the list
          setLearningObjectives(prev => [createdLO, ...prev])

          // Update available prerequisites to include the newly created LO
          const updatedPrerequisites = [...availablePrerequisites, {
            id: createdLO.id,
            title: createdLO.title,
            lo_code: createdLO.lo_code,
          }]
          setAvailablePrerequisites(updatedPrerequisites)

          // Handle dependencies with graph type
          if (form.prerequisites && form.prerequisites.length > 0) {
            // Create an array of dependency records with graph type
            const dependencies = form.prerequisites.map(prereqId => ({
              lo_id: prereqId,
              dependent_lo_id: nextId,
              graph: form.graph  // Store graph type in lo_dependencies
            }))

            const { error: depError } = await supabase
              .from('lo_dependencies')
              .insert(dependencies)

            if (depError) {
              console.error('Error creating dependencies:', depError)
              alert('LO created but failed to create dependencies')
              return
            }
          }

          alert('Learning objective created successfully!')
          setShowForm(false)
        } catch (error: any) {
          console.error('Error in LO creation:', error)
          alert(`An unexpected error occurred: ${error.message}`)
        }
      }
    } catch (error: any) {
      console.error('Error in handleSubmit:', error)
      alert(`An unexpected error occurred: ${error.message}`)
    }
  }

  const handleEdit = (lo: LearningObjective) => {
    // Fetch existing dependencies
    const fetchDependencies = async () => {
      // First refresh available prerequisites
      await fetchAvailablePrerequisites()
      
      const { data: deps, error } = await supabase
        .from('lo_dependencies')
        .select('*')
        .eq('dependent_lo_id', lo.id)
      
      if (error) {
        console.error('Error fetching dependencies:', error)
        return
      }

      // Get graph type from first dependency (assuming all dependencies have same type)
      const graphType = deps?.[0]?.graph || 'AND'
      
      setForm({
        title: lo.title,
        description: lo.description,
        lo_code: lo.lo_code,
        mastery_threshold: lo.mastery_threshold,
        confidence_delta: lo.confidence_delta,
        min_samples: lo.min_samples,
        difficulty: lo.difficulty,
        concept_weight: lo.concept_weight,
        time_decay_factor: lo.time_decay_factor,
        materials: [],
        prerequisites: deps?.map(d => d.lo_id) || [],
        graph: graphType as 'AND' | 'OR'
      })
    }

    fetchDependencies()
    setEditingId(lo.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this learning objective?')) return

    try {
      // First delete all dependencies where this LO is either the prerequisite or dependent
      const { error: depError } = await supabase
        .from('lo_dependencies')
        .delete()
        .or(`lo_id.eq.${id},dependent_lo_id.eq.${id}`)

      if (depError) {
        console.error('Error deleting dependencies:', depError)
        alert('Failed to delete dependencies')
        return
      }

      // Delete associated learning materials from storage and table
      const { data: materialsToDelete, error: fetchMaterialsError } = await supabase
        .from('learning_materials')
        .select('id, url')
        .eq('lo_id', id)

      if (fetchMaterialsError) {
        console.error('Error fetching materials to delete:', fetchMaterialsError)
        // Continue with LO deletion even if materials fetch fails
      }

      if (materialsToDelete && materialsToDelete.length > 0) {
        const filePaths = materialsToDelete.map(mat => `lo-materials/${mat.url.split('/lo-materials/')[1]}`)
        const { error: storageError } = await supabase.storage.from('lo-materials').remove(filePaths)

        if (storageError) {
          console.error('Error deleting materials from storage:', storageError)
          // Continue with LO deletion even if storage deletion fails
        }

        const { error: deleteMaterialsError } = await supabase
          .from('learning_materials')
          .delete()
          .in('id', materialsToDelete.map(mat => mat.id))

        if (deleteMaterialsError) {
          console.error('Error deleting materials from table:', deleteMaterialsError)
          // Continue with LO deletion even if table deletion fails
        }
      }

      // Then delete the LO
      const { error: loError } = await supabase
        .from('learning_objectives')
        .delete()
        .eq('id', id)

      if (loError) {
        console.error('Error deleting learning objective:', loError)
        alert('Failed to delete learning objective')
        return
      }

      // Update local state
      setLearningObjectives(learningObjectives.filter(lo => lo.id !== id))
      // Also remove from available prerequisites if it's there
      setAvailablePrerequisites(prev => prev.filter(lo => lo.id !== id))
      // Remove materials from allMaterials state
      setAllMaterials(prev => {
        const newState = { ...prev }
        delete newState[id]
        return newState
      })

      alert('Learning objective and associated data deleted successfully')
    } catch (error) {
      console.error('Error in handleDelete:', error)
      alert('An error occurred while deleting')
    }
  }

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      lo_code: '',
      mastery_threshold: 0.7,
      confidence_delta: 0.15,
      min_samples: 3,
      difficulty: 1,
      concept_weight: 1.0,
      time_decay_factor: 0.1,
      materials: [],
      prerequisites: [],
      graph: 'AND'
    })
    setEditingId(null)
    setShowForm(false)
    setMaterialFiles([]) // Clear material files state on form close
    setUploadError(null) // Clear upload error
  }

  // Update useEffect to fetch prerequisites when form is opened
  useEffect(() => {
    if (showForm) {
      fetchAvailablePrerequisites()
      // Note: materials for edit are fetched within handleEdit
    } else {
      // Clear materialFiles when form is closed
      setMaterialFiles([])
      setUploadError(null)
    }
  }, [showForm]) // Add this effect to fetch prerequisites and manage materialFiles state when form opens/closes

  // Khi mở form edit/add, nếu editingId có giá trị thì fetch file từ bảng learning_materials
  useEffect(() => {
    if (showForm && editingId) {
      fetchLearningMaterials(editingId)
    } else if (showForm && !editingId) {
      setMaterialFiles([])
    }
  }, [showForm, editingId])

  const fetchLearningMaterials = async (loId: number) => {
    const { data, error } = await supabase
      .from('learning_materials')
      .select('*, uploaded_by(name)') // Fetch uploader name
      .eq('lo_id', loId)
      .order('created_at', { ascending: true })
    if (!error && data) {
      setMaterialFiles(data)
      return data
    } else {
      console.error('Error fetching learning materials:', error)
      setMaterialFiles([])
      return []
    }
  }

  // Upload handler mới: upload lên storage, insert metadata vào bảng learning_materials
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadError(null)
    const userId = sessionStorage.getItem('userId') // Get userId as string
    if (!userId) {
      setUploadError('User not logged in')
      setUploading(false)
      return
    }

    const uploadedMaterials: LearningMaterial[] = [] // Explicitly type array

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()

      // Sanitize file name for storage key
      const sanitizedFileName = file.name
        .normalize('NFD').replace(/[̀-ͯ]/g, '') // Remove Vietnamese accents
        .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace special characters with underscore

      const filePath = `lo-materials/${uuidv4()}-${sanitizedFileName}` // Use sanitized name in storage path

      const { data, error } = await supabase.storage.from('lo-materials').upload(filePath, file)
      if (error) {
        setUploadError(`Error uploading ${file.name}: ${error.message}`)
        setUploading(false)
        // Stop further uploads on first error
        return
      }
      // Get public URL
      const { data: publicUrlData } = supabase.storage.from('lo-materials').getPublicUrl(filePath)
      // Insert metadata vào bảng learning_materials, bao gồm tên file gốc
      const { data: insertData, error: insertError } = await supabase
        .from('learning_materials')
        .insert({
          lo_id: editingId || undefined, // Set lo_id if editing, undefined if adding (will be updated later)
          type: ext || 'file',
          url: publicUrlData.publicUrl,
          uploaded_by: parseInt(userId), // Parse userId to integer
          name: file.name // Lưu tên file gốc
        })
        .select()
        .single()
      if (!insertError && insertData) {
        uploadedMaterials.push(insertData as LearningMaterial) // Type assertion
      } else if (insertError) {
        setUploadError(`Error saving metadata for ${file.name}: ${insertError.message}`)
        // Optionally remove the uploaded file from storage if metadata insert fails
        await supabase.storage.from('lo-materials').remove([filePath]);
        setUploading(false)
        return
      }
    }
    // Update materialFiles state with all successfully uploaded materials
    setMaterialFiles(prev => [...prev, ...uploadedMaterials])
    setUploading(false)
  }

  // Xóa file: xóa record trong bảng và xóa file trên storage
  const handleRemoveMaterial = async (material: LearningMaterial) => {
     if (!confirm(`Are you sure you want to delete ${material.name || material.url.split('/').pop()}?`)) return
    try {
      // Xóa file trên storage
      // Extract the part of the URL that is the storage path after the bucket name
      const urlParts = material.url.split('/lo-materials/');
      const filePath = urlParts.length > 1 ? urlParts[1] : null; // Get the part after '/lo-materials/'

      if (filePath) {
         // Supabase storage remove expects paths relative to the bucket root
        const { error: storageError } = await supabase.storage.from('lo-materials').remove([filePath]);
         if (storageError) {
            console.error('Error deleting material from storage:', storageError);
            alert(`Failed to delete file ${material.name} from storage.`);
            // Continue to delete metadata even if storage deletion fails
         }
      } else {
         console.error('Could not determine storage file path from URL:', material.url);
         alert(`Could not determine storage path for ${material.name}. Attempting to delete metadata only.`);
      }

      // Xóa record trong bảng
      const { error: dbError } = await supabase.from('learning_materials').delete().eq('id', material.id);
      if (dbError) {
         console.error('Error deleting material metadata:', dbError);
         alert(`Failed to delete metadata for ${material.name}.`);
         return; // Stop if metadata deletion fails
      }

      setMaterialFiles(prev => prev.filter(m => m.id !== material.id));

      // Also remove from allMaterials state if it exists there
      setAllMaterials(prev => {
        const newState = { ...prev };
        if (material.lo_id && newState[material.lo_id]) {
          newState[material.lo_id] = newState[material.lo_id].filter(m => m.id !== material.id);
          // If no materials left for this LO, remove the LO entry from allMaterials
          if (newState[material.lo_id].length === 0) {
            delete newState[material.lo_id];
          }
        }
        return newState;
      });

      alert(`Material ${material.name || 'file'} deleted successfully.`);

    } catch (error) {
      console.error('Error in handleRemoveMaterial:', error);
      alert('An error occurred while deleting the material.');
    }
  };

  // Update lo_id for uploaded files when a new LO is successfully created
  useEffect(() => {
    // This effect should run after a new LO is created and learningObjectives state is updated
    // We need a way to identify newly uploaded files that don't have an lo_id yet
    // A better approach is to handle this within the handleSubmit logic for new LOs
  }, [learningObjectives]); // Consider removing or refactoring this effect

  // Handle LO click
  const handleLoClick = (loId: number) => {
    setSelectedLoId(loId);
  };

  // Add useEffect to fetch materials when selectedLoId changes
  useEffect(() => {
    if (selectedLoId) {
      fetchLearningMaterials(selectedLoId).then(materials => {
        setSelectedLoMaterials(materials);
      });
    } else {
      setSelectedLoMaterials([]);
    }
  }, [selectedLoId]);

  // Handle download file
  const handleDownload = (url: string, filename: string) => {
    // This is a simple client-side download. For better handling, especially with security, consider a server-side approach.
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            onClick={() => {
              setShowForm(true);
              setEditingId(null); // Ensure editingId is null for new LO
              resetForm(); // Reset form fields
            }}
            className="bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
          >
            Add New Learning Objective
          </button>
        </div>

        {/* Layout hai cột */}
        <div className="flex gap-6">
          {/* Cột trái: Danh sách LOs */}
          <div className="w-1/2 bg-white shadow rounded-lg p-6">
            {learningObjectives.length === 0 ? (
              <p className="text-gray-500">No learning objectives added yet</p>
            ) : (
              <div className="space-y-4">
                {learningObjectives.map(lo => (
                  <div
                    key={lo.id}
                    className={`border rounded p-4 cursor-pointer transition-colors ${
                      selectedLoId === lo.id ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleLoClick(lo.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {lo.lo_code}: {lo.title}
                        </h3>
                        {lo.description && (
                          <p className="text-gray-600 mt-1 text-sm">{lo.description}</p>
                        )}
                        {/* Các thông số khác của LO */}
                        <div className="mt-2 text-xs text-gray-500">
                          <p>Mastery Threshold: {lo.mastery_threshold}</p>
                          <p>Confidence Delta: {lo.confidence_delta}</p>
                          <p>Min Samples: {lo.min_samples}</p>
                          <p>Difficulty: {lo.difficulty === 1 ? 'Easy' : lo.difficulty === 2 ? 'Medium' : 'Hard'}</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(lo); }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(lo.id); }}
                          className="text-red-600 hover:text-red-800 text-sm"
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

          {/* Cột phải: Chi tiết LO (Attachments) */}
          <div className="w-1/2 bg-white shadow rounded-lg p-6">
            {selectedLoId === null ? (
              <div className="text-gray-500 text-center">
                Select a Learning Objective to view details and attachments.
              </div>
            ) : (
              <div>
                <h3 className="text-xl font-semibold text-[#0f2a4e] mb-4">Attachments for LO {learningObjectives.find(lo => lo.id === selectedLoId)?.lo_code}</h3>
                {selectedLoMaterials.length === 0 ? (
                  <p className="text-gray-500">No attachments for this Learning Objective.</p>
                ) : (
                  <ul className="space-y-3">
                    {selectedLoMaterials.map(mat => (
                      <li key={mat.id} className="flex items-center justify-between border-b pb-2">
                        <a href={mat.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline mr-4 truncate">
                           {mat.name || mat.url.split('/').pop()} {/* Hiển thị tên file */}
                        </a>
                        <button
                          onClick={() => handleRemoveMaterial(mat)}
                          className="text-red-500 hover:text-red-700"
                          title="Delete attachment"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Learning Objective Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white p-6 rounded-lg w-full max-w-2xl my-8 max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 z-10 bg-white pb-2 border-b">
                <h2 className="text-xl font-semibold mb-4">
                  {editingId ? 'Edit Learning Objective' : 'Add New Learning Objective'}
                </h2>
              </div>
              
              {/* Basic Info */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Basic Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded px-3 py-2"
                      value={form.title}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="Enter a clear, concise title"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <textarea
                      className="w-full border rounded px-3 py-2"
                      value={form.description}
                      onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe what students should be able to do"
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Assessment Parameters */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Assessment Parameters</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Mastery Threshold (ξ) <span className="text-red-500">*</span>
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
                    <p className="text-xs text-gray-500 mt-1">Default: 0.7 - Minimum score to consider mastery</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Confidence Delta (δ) <span className="text-red-500">*</span>
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
                    <p className="text-xs text-gray-500 mt-1">Default: 0.15 - Acceptable error margin</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Min Samples <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full border rounded px-3 py-2"
                      value={form.min_samples}
                      onChange={e => setForm({ ...form, min_samples: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Default: 3 - Minimum attempts needed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Difficulty <span className="text-red-500">*</span>
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
                </div>
              </div>

              {/* Prerequisites with Graph Type */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Prerequisites</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Graph Type</label>
                    <select
                      className="w-full border rounded px-3 py-2"
                      value={form.graph}
                      onChange={(e) => setForm(prev => ({
                        ...prev,
                        graph: e.target.value as 'AND' | 'OR'
                      }))}
                    >
                      <option value="AND">AND (All prerequisites must be met)</option>
                      <option value="OR">OR (Any prerequisite can be met)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {form.graph === 'AND' 
                        ? 'Student must master ALL selected prerequisites'
                        : 'Student can master ANY of the selected prerequisites'}
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Required Learning Objectives</label>
                    <select
                      multiple
                      className="w-full border rounded px-3 py-2 min-h-[150px]"
                      value={form.prerequisites.map(String) as unknown as string[]}
                      onChange={(e) => {
                        const selected = Array.from(e.target.selectedOptions, option => Number(option.value))
                        setForm(prev => ({ ...prev, prerequisites: selected }))
                      }}
                    >
                      {availablePrerequisites.length === 0 ? (
                        <option disabled>No learning objectives available</option>
                      ) : (
                        availablePrerequisites.map(lo => (
                          <option key={lo.id} value={lo.id}>
                            {lo.lo_code} - {lo.title}
                          </option>
                        ))
                      )}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Hold Ctrl (Windows) or Command (Mac) to select multiple prerequisites
                    </p>
                  </div>
                </div>
              </div>

              {/* Upload Materials */}
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Attach Materials</h3>
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="mb-2"
                  disabled={uploading}
                />
                {uploading && <div className="text-blue-600 text-sm mb-2">Uploading...</div>}
                {uploadError && <div className="text-red-600 text-sm mb-2">{uploadError}</div>}
                {materialFiles.length > 0 && (
                  <ul className="list-disc ml-6 text-sm">
                    {materialFiles.map((mat) => (
                      <li key={mat.id} className="flex items-center space-x-2">
                        <a href={mat.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">
                          {mat.url.split('/').pop()}
                        </a>
                        <button
                          type="button"
                          className="text-red-500 hover:underline text-xs"
                          onClick={() => handleRemoveMaterial(mat)}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 text-white bg-[#0f2a4e] rounded hover:bg-blue-800"
                >
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

