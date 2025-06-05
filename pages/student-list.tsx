import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import Link from 'next/link'

interface Course {
  id: string
  name: string
  code: string
  description: string
  lecturer_id: string
  created_at: string
}

interface Student {
  id: string
  email: string
  name: string
  enrolled_at: string
  assessment_sessions_count: number
  completed_sessions_count: number
  in_progress_sessions_count: number
}

interface Enrollment {
  user_id: string
  created_at: string
  users: {
    id: string
    email: string
    name: string
  }
}

export default function StudentList() {
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>('')
  const [students, setStudents] = useState<Student[]>([])
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    if (selectedCourse) {
      fetchEnrolledStudents(selectedCourse)
    } else {
      setStudents([])
      setFilteredStudents([])
    }
  }, [selectedCourse])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStudents(students)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = students.filter(student => 
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query)
      )
      setFilteredStudents(filtered)
    }
  }, [searchQuery, students])

  const fetchCourses = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setCourses(data || [])
    } catch (error: any) {
      console.error('Error fetching courses:', error)
      setError('Failed to load courses')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchEnrolledStudents = async (courseId: string) => {
    try {
      setIsLoading(true)
      // First fetch enrolled students
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('enrollments')
        .select(`
          student_id,
          enrolled_at,
          users:student_id (
            id,
            email,
            name
          )
        `)
        .eq('course_id', courseId)
        .order('enrolled_at', { ascending: false })

      if (enrollmentsError) throw enrollmentsError

      // Then fetch assessment sessions for all students in this course
      const studentIds = enrollmentsData?.map(e => e.student_id) || []
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('assessment_sessions')
        .select('*')
        .in('student_id', studentIds)
        .eq('course_id', courseId)

      if (sessionsError) throw sessionsError

      // Transform the data to match our Student interface
      const transformedStudents = (enrollmentsData || []).map((enrollment: any) => {
        const studentSessions = sessionsData?.filter(s => s.student_id === enrollment.student_id) || []
        return {
          id: enrollment.users.id,
          email: enrollment.users.email,
          name: enrollment.users.name,
          enrolled_at: enrollment.enrolled_at,
          assessment_sessions_count: studentSessions.length,
          completed_sessions_count: studentSessions.filter(s => s.end_time !== null).length,
          in_progress_sessions_count: studentSessions.filter(s => s.status === 'in_progress').length
        }
      })

      setStudents(transformedStudents)
    } catch (error: any) {
      console.error('Error fetching enrolled students:', error)
      setError('Failed to load enrolled students')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/dashboard-lecturer" 
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

        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-[#0f2a4e] mb-6">Student List</h1>

          {/* Course Selection */}
          <div className="mb-6">
            <label htmlFor="course" className="block text-sm font-medium text-gray-700 mb-2">
              Select Course
            </label>
            <select
              id="course"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#0f2a4e] focus:border-[#0f2a4e]"
            >
              <option value="">Select a course</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} - {course.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          {selectedCourse && (
            <div className="mb-6">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
                Search Students
              </label>
              <input
                type="text"
                id="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#0f2a4e] focus:border-[#0f2a4e]"
              />
            </div>
          )}

          {/* Student List */}
          {isLoading ? (
            <div className="text-center py-4">Loading...</div>
          ) : error ? (
            <div className="text-red-500 text-center py-4">{error}</div>
          ) : selectedCourse ? (
            <div>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-[#0f2a4e]">
                  Enrolled Students ({filteredStudents.length})
                </h2>
              </div>
              {filteredStudents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Enrolled Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Sessions
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Completed
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          In Progress
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{student.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">{student.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {new Date(student.enrolled_at).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {student.assessment_sessions_count}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {student.completed_sessions_count}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-500">
                              {student.in_progress_sessions_count}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  {searchQuery ? 'No students found matching your search.' : 'No students enrolled in this course yet.'}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              Please select a course to view enrolled students.
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 