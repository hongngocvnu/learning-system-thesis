import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Header from '../components/Header'

interface Course {
  id: string
  name: string
  code: string
  description: string
}

interface Enrollment {
  id: string
  course_id: string
  student_id: string
  enrolled_at: string
}

export default function StudentDashboard() {
  const router = useRouter()
  const [availableCourses, setAvailableCourses] = useState<Course[]>([])
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          console.error('No user found')
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
          .eq('student_id', user.id)

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
        }
      } catch (error) {
        console.error('Error in fetchData:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleEnroll = async (courseId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('No user found')
        return
      }

      const { error } = await supabase
        .from('enrollments')
        .insert({
          course_id: courseId,
          student_id: user.id,
          enrolled_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error enrolling in course:', error)
        return
      }

      // Refresh enrolled courses
      const enrolledCourse = availableCourses.find(course => course.id === courseId)
      if (enrolledCourse) {
        setEnrolledCourses([...enrolledCourses, enrolledCourse])
      }
    } catch (error) {
      console.error('Error in handleEnroll:', error)
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
                  className="bg-white shadow rounded-lg p-6 cursor-pointer hover:shadow-md transition-shadow duration-200"
                  onClick={() => router.push(`/student-course/${course.id}`)}
                >
                  <h3 className="text-lg font-semibold mb-2 text-[#0f2a4e]">
                    {course.code} - {course.name}
                  </h3>
                  <p className="text-gray-600 text-sm">{course.description}</p>
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