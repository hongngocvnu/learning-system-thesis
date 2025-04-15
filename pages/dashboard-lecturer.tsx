import React from 'react'
import Header from '../components/Header'
import Link from 'next/link'

export default function DashboardLecturer() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <Header />
      <div className="flex">
        {/* Sidebar */}
        <aside className="bg-white w-64 min-h-screen p-4 shadow-md">
          <nav className="space-y-4">
            <Link href="/dashboard-lecturer" className="block text-[#0f2a4e] font-medium hover:bg-[#0f2a4e] hover:text-white px-4 py-2 rounded-lg transition-colors duration-200">
              Dashboard
            </Link>
            <Link href="/lecturer-courses" className="block text-[#0f2a4e] font-medium hover:bg-[#0f2a4e] hover:text-white px-4 py-2 rounded-lg transition-colors duration-200">
              Manage Courses
            </Link>
            <Link href="/lecturer-chapters" className="block text-[#0f2a4e] font-medium hover:bg-[#0f2a4e] hover:text-white px-4 py-2 rounded-lg transition-colors duration-200">
              Course Chapters
            </Link>
            <Link href="#" className="block text-[#0f2a4e] font-medium hover:bg-[#0f2a4e] hover:text-white px-4 py-2 rounded-lg transition-colors duration-200">
              Student List
            </Link>
            <Link href="/lecturer-questions" className="block text-[#0f2a4e] font-medium hover:bg-[#0f2a4e] hover:text-white px-4 py-2 rounded-lg transition-colors duration-200">
              Created Questions
            </Link>
            <Link href="#" className="block text-[#0f2a4e] font-medium hover:bg-[#0f2a4e] hover:text-white px-4 py-2 rounded-lg transition-colors duration-200">
              Analytics
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <h2 className="text-2xl font-bold text-[#0f2a4e] mb-6">Dashboard Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link href="/lecturer-courses" className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition-shadow duration-200 border border-gray-100">
              <h3 className="text-lg font-semibold text-[#0f2a4e] mb-2">Manage Courses</h3>
              <p className="text-gray-600">View and edit your courses</p>
            </Link>
            <Link href="/lecturer-chapters" className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition-shadow duration-200 border border-gray-100">
              <h3 className="text-lg font-semibold text-[#0f2a4e] mb-2">Course Chapters</h3>
              <p className="text-gray-600">Manage course chapters and content</p>
            </Link>
            <div className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition-shadow duration-200 border border-gray-100">
              <h3 className="text-lg font-semibold text-[#0f2a4e] mb-2">Student List</h3>
              <p className="text-gray-600">See enrolled students</p>
            </div>
            <Link href="/lecturer-questions" className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition-shadow duration-200 border border-gray-100">
              <h3 className="text-lg font-semibold text-[#0f2a4e] mb-2">Created Questions</h3>
              <p className="text-gray-600">Manage your question bank</p>
            </Link>
            <div className="bg-white rounded-xl shadow p-4 hover:shadow-lg transition-shadow duration-200 border border-gray-100">
              <h3 className="text-lg font-semibold text-[#0f2a4e] mb-2">Analytics</h3>
              <p className="text-gray-600">Check student performance</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
