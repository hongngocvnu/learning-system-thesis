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
  created_at: string
}

interface Chapter {
  id: number
  course_id: string
  title: string
  order_num: number
  created_by: number
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
  created_by: number
  created_at: string
}

interface Lecturer {
  id: string
  email: string
  name: string
}

interface LearningMaterial {
  id: string
  lo_id: number
  type: string
  url: string
  name?: string
  created_at: string
  uploaded_by: number
}

export default function StudentCourse() {
  const router = useRouter()
  const { courseId } = router.query
  const [course, setCourse] = useState<Course | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [learningObjectives, setLearningObjectives] = useState<LearningObjective[]>([])
  const [lecturer, setLecturer] = useState<Lecturer | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLoId, setSelectedLoId] = useState<number | null>(null)
  const [selectedLoMaterials, setSelectedLoMaterials] = useState<LearningMaterial[]>([])

  useEffect(() => {
    if (router.isReady && courseId) {
      fetchCourseData(courseId as string)
    }
  }, [router.isReady, courseId])

  const fetchCourseData = async (courseId: string) => {
    if (!courseId) return

    try {
      setIsLoading(true)

      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (courseError) throw courseError
      setCourse(courseData as Course)

      if (courseData.lecturer_id) {
        const { data: lecturerData, error: lecturerError } = await supabase
          .from('users')
          .select('id, name, email')
          .eq('id', courseData.lecturer_id)
          .single()

        if (lecturerError) throw lecturerError
        setLecturer(lecturerData as Lecturer)
      }

      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .eq('course_id', courseId)
        .order('order_num', { ascending: true })

      if (chaptersError) throw chaptersError
      setChapters(chaptersData || [])

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

  const handleChapterClick = (chapterId: number) => {
    setSelectedChapter(selectedChapter === chapterId ? null : chapterId)
  }

  useEffect(() => {
    const fetchSelectedLoMaterials = async () => {
      if (selectedLoId !== null) {
        console.log('Fetching materials for LO ID:', selectedLoId)
        const { data, error } = await supabase
          .from('learning_materials')
          .select('*')
          .eq('lo_id', selectedLoId)
          .order('created_at', { ascending: true });
        if (!error && data) {
          console.log('Fetched materials:', data)
          setSelectedLoMaterials(data as LearningMaterial[]);
        } else {
          setSelectedLoMaterials([]);
          console.error('Error fetching selected LO materials:', error);
        }
      } else {
        setSelectedLoMaterials([]);
      }
    };
    fetchSelectedLoMaterials();
  }, [selectedLoId]);

  const handleLoClick = (loId: number) => {
    console.log('LO clicked, setting selectedLoId:', loId)
    setSelectedLoId(loId);
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      console.log('Starting download process...');
      console.log('Original URL:', url);
      
      // Extract the file path from the URL
      const urlParts = url.split('/');
      const filePath = urlParts.slice(-2).join('/'); // Get "lo-materials/[filename]"
      
      console.log('Using file path:', filePath);
      
      if (!filePath) {
        throw new Error('Invalid file path');
      }

      // Get signed URL from Supabase Storage
      console.log('Requesting signed URL from Supabase...');
      const { data: signedUrl, error } = await supabase
        .storage
        .from('lo-materials')
        .createSignedUrl(filePath, 60);

      if (error) {
        console.error('Supabase Storage Error:', error);
        throw error;
      }

      if (!signedUrl?.signedUrl) {
        throw new Error('Failed to generate download URL');
      }

      // Fetch the file content
      const response = await fetch(signedUrl.signedUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch file');
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();

      // Clean up
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      // Show success message
      alert('File downloaded successfully!');
    } catch (error: any) {
      console.error('Download error:', error);
      alert(`Failed to download file: ${error.message}`);
    }
  };

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

  const selectedLo = learningObjectives.find(lo => lo.id === selectedLoId);

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
            className="bg-white border-2 border-[#0f2a4e] text-[#0f2a4e] px-6 py-2 rounded-lg hover:bg-[#0f2a4e] hover:text-white transition-colors shadow-sm font-semibold"
          >
            Take Course Test
          </button>
        </div>

        <div className="flex gap-6">
          <div className="w-1/2 bg-white rounded-lg shadow-md p-6">
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
                  {selectedChapter === chapter.id && (
                    <div className="mt-4 pl-4 border-l-2 border-[#0f2a4e]">
                      <h4 className="text-sm font-medium text-[#0f2a4e] mb-2">Learning Objectives:</h4>
                      <div className="space-y-2">
                        {learningObjectives
                          .filter(lo => lo.chapter_id === chapter.id)
                          .map(lo => (
                            <div
                              key={lo.id}
                              className={`text-sm text-gray-600 cursor-pointer hover:text-[#0f2a4e] ${selectedLoId === lo.id ? 'font-semibold text-[#0f2a4e]' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLoClick(lo.id);
                              }}
                            >
                              <span className="font-medium">{lo.lo_code}:</span> {lo.title}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="w-1/2 bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-[#0f2a4e] mb-4">Attachments</h2>
            {selectedLoId === null ? (
              <div className="text-gray-500 text-center">
                Select a Learning Objective from the left to view its attachments.
              </div>
            ) : selectedLoMaterials.length === 0 ? (
              <div>
                <h3 className="text-lg font-medium mb-3">For LO {selectedLo?.lo_code}</h3>
                <p className="text-gray-500">No attachments available for this Learning Objective.</p>
              </div>
            ) : (
              <div>
                 <h3 className="text-lg font-medium mb-3">For LO {selectedLo?.lo_code}</h3>
                <ul className="space-y-3">
                  {selectedLoMaterials.map(mat => (
                    <li key={mat.id} className="flex items-center justify-between border-b pb-2">
                      <a 
                        href={mat.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-blue-700 hover:underline mr-4 truncate"
                        onClick={(e) => {
                          e.preventDefault();
                          // For PDF files, open in new tab with proper viewer
                          if (mat.url.toLowerCase().endsWith('.pdf')) {
                            window.open(mat.url, '_blank');
                          } else {
                            // For other file types, use download
                            handleDownload(mat.url, mat.name || mat.url.split('/').pop() || 'download');
                          }
                        }}
                      >
                        {mat.name || mat.url.split('/').pop()}
                      </a>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          handleDownload(mat.url, mat.name || mat.url.split('/').pop() || 'download');
                        }}
                        className="text-gray-500 hover:text-[#0f2a4e] flex-shrink-0"
                        title="Download file"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm16-7a1 1 0 01-1 1h-4v2a1 1 0 11-2 0v-2H8a1 1 0 01-1-1V6a1 1 0 011-1h3V3a1 1 0 112 0v2h3a1 1 0 011 1v4z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
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
          <div></div>
        </div>
      </div>
    </div>
  )
} 