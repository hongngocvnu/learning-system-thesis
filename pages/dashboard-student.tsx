import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Header from '../components/Header'
import { v4 as uuidv4 } from 'uuid'

interface Course {
  id: number
  name: string
  code: string
  description: string
}

interface Enrollment {
  id: number
  course_id: number
  student_id: number
  enrolled_at: string
}

export default function StudentDashboard() {
  const router = useRouter()
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [showMenuId, setShowMenuId] = useState<number | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('No user found')
          return
        }

        // Get user_id from users table
        const { data: userData, error: userDataError } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single()

        if (userDataError) {
          console.error('Error getting user data:', userDataError)
          return
        }
        if (!userData) {
          console.error('User not found in database')
          return
        }

        // Fetch all courses
        const { data: coursesData, error: coursesError } = await supabase
          .from('courses')
          .select('*')

        if (coursesError) {
          console.error('Error fetching courses:', coursesError)
          return
        }

        if (coursesData) {
          setAvailableCourses(coursesData as Course[])
        }

        // Fetch enrolled courses
        const { data: enrollmentsData, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('student_id', userData.id)

        if (enrollmentsError) {
          console.error('Error fetching enrollments:', enrollmentsError)
          return
        }

        if (enrollmentsData) {
          const enrolledCourseIds = enrollmentsData.map(e => e.course_id)
          const enrolledCourses = coursesData.filter(course => 
            enrolledCourseIds.includes(course.id)
          ) as Course[]
          setEnrolledCourses(enrolledCourses)
          // Update available courses to exclude enrolled ones
          setAvailableCourses(coursesData.filter(course => 
            !enrolledCourseIds.includes(course.id)
          ) as Course[])
        }
      } catch (error) {
        console.error('Error in fetchData:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleEnroll = async (courseId: number) => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Error getting user:', userError)
        alert('Error: Please log in again')
        return
      }
      if (!user) {
        console.error('No user found')
        alert('Error: Please log in again')
        return
      }

      // Get user_id from users table
      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single()

      if (userDataError) {
        console.error('Error getting user data:', userDataError)
        throw new Error('Failed to get user data')
      }
      if (!userData) {
        throw new Error('User not found in database')
      }

      console.log('Attempting to enroll user:', userData.id, 'in course:', courseId)

      // Check if already enrolled
      const { data: existingEnrollment, error: checkError } = await supabase
        .from('enrollments')
        .select('*')
        .eq('student_id', userData.id)
        .eq('course_id', courseId)
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error checking existing enrollment:', checkError)
        throw checkError
      }

      if (existingEnrollment) {
        alert('You are already enrolled in this course')
        return
      }

      // Create enrollment
      const { error: enrollError } = await supabase
        .from('enrollments')
        .insert({
          student_id: userData.id,
          course_id: courseId
        })

      if (enrollError) {
        console.error('Error enrolling in course:', enrollError)
        throw enrollError
      }

      // Update UI
      const enrolledCourse = availableCourses.find(course => course.id === courseId)
      if (enrolledCourse) {
        setEnrolledCourses([...enrolledCourses, enrolledCourse])
        setAvailableCourses(availableCourses.filter(course => course.id !== courseId))
        alert('Successfully enrolled in the course!')
      }
    } catch (error: any) {
      console.error('Error in handleEnroll:', error)
      alert(`Error enrolling in course: ${error.message}`)
    }
  }

  const handleLeaveCourse = async (courseId: number) => {
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('Error getting user:', userError)
        alert('Error: Please log in again')
        return
      }
      if (!user) {
        console.error('No user found')
        alert('Error: Please log in again')
        return
      }

      // Get user_id from users table
      const { data: userData, error: userDataError } = await supabase
        .from('users')
        .select('id')
        .eq('email', user.email)
        .single()

      if (userDataError) {
        console.error('Error getting user data:', userDataError)
        throw new Error('Failed to get user data')
      }
      if (!userData) {
        throw new Error('User not found in database')
      }

      // Delete enrollment
      const { error: deleteError } = await supabase
        .from('enrollments')
        .delete()
        .eq('student_id', userData.id)
        .eq('course_id', courseId)

      if (deleteError) {
        console.error('Error leaving course:', deleteError)
        throw deleteError
      }

      // Update UI
      const leftCourse = enrolledCourses.find(course => course.id === courseId)
      if (leftCourse) {
        setEnrolledCourses(enrolledCourses.filter(course => course.id !== courseId))
        setAvailableCourses([...availableCourses, leftCourse])
        alert('Successfully left the course!')
      }
    } catch (error: any) {
      console.error('Error in handleLeaveCourse:', error)
      alert(`Error leaving course: ${error.message}`)
    }
  }

  const filteredCourses = availableCourses.filter(course => 
    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header />
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6 text-[#0f2a4e]">Student Dashboard</h1>

        {/* My Courses Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-[#0f2a4e]">My Courses</h2>
          {isLoading ? (
            <div className="text-center py-4">Loading...</div>
          ) : enrolledCourses.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              You haven't enrolled in any courses yet
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledCourses.map(course => (
                <div 
                  key={course.id}
                  className="bg-white shadow rounded-lg p-6"
                >
                  <h3 className="text-lg font-semibold mb-2 text-[#0f2a4e]">
                    {course.code} - {course.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">{course.description}</p>
                  <div className="flex space-x-2 items-center">
                    <button
                      onClick={() => router.push(`/student-course/${course.id}`)}
                      className="flex-1 bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
                    >
                      View
                    </button>
                    <button
                      onClick={() => router.push(`/student-test/${course.id}`)}
                      className="flex-1 bg-white text-[#0f2a4e] px-4 py-2 rounded border-2 border-[#0f2a4e] hover:bg-[#0f2a4e] hover:text-white"
                    >
                      Take Test
                    </button>
                    <div className="relative">
                      <button
                        className="p-2 rounded-full hover:bg-gray-100"
                        onClick={() => setShowMenuId(showMenuId === course.id ? null : course.id)}
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="1.5" />
                          <circle cx="19.5" cy="12" r="1.5" />
                          <circle cx="4.5" cy="12" r="1.5" />
                        </svg>
                      </button>
                      {showMenuId === course.id && (
                        <div className="absolute right-0 mt-2 w-32 bg-white border rounded shadow z-10">
                          <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
                            onClick={() => {
                              handleLeaveCourse(course.id);
                              setShowMenuId(null);
                            }}
                          >
                            Leave
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Available Courses Section */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-[#0f2a4e]">Available Courses</h2>
            <input
              type="text"
              placeholder="Search courses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2a4e]"
            />
          </div>
          {isLoading ? (
            <div className="text-center py-4">Loading...</div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No courses found
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map(course => (
                <div key={course.id} className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-2 text-[#0f2a4e]">
                    {course.code} - {course.name}
                  </h3>
                  <p className="text-gray-600 text-sm mb-4">{course.description}</p>
                  <button
                    onClick={() => handleEnroll(course.id)}
                    className="w-full bg-[#0f2a4e] text-white px-4 py-2 rounded hover:bg-blue-800"
                  >
                    Register
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 