import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Link from 'next/link'

export default function Header() {
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('email', user.email)
          .single()
        if (userData) {
          setUserName(userData.name)
          setUserRole(userData.role)
          // Store user ID in session storage if not already present
          if (!sessionStorage.getItem('userId')) {
            sessionStorage.setItem('userId', userData.id.toString())
          }
        }
      }
    }
    fetchUserData()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    sessionStorage.removeItem('userId')
    router.push('/login')
  }

  const getDashboardPath = () => {
    if (userRole === 'lecturer') {
      return '/dashboard-lecturer'
    } else if (userRole === 'student') {
      return '/dashboard-student'
    }
    return '/login'
  }

  return (
    <header className="bg-white shadow-md py-4 px-6 relative flex items-center" style={{minHeight: '64px'}}>
      {/* Logo bên trái */}
      <div className="flex items-center z-10">
        <img src="/img/vnuislogo-2.png" alt="VNU Logo" className="h-10" />
      </div>
      {/* Chữ ở giữa tuyệt đối */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <Link
          href={getDashboardPath()}
          className="text-2xl font-oswald font-bold text-[#0f2a4e] hover:text-blue-800 transition-colors duration-200"
        >
          E-Learning System 
        </Link>
      </div>
      {/* Nút logout bên phải */}
      <div className="flex items-center space-x-4 ml-auto z-10">
        <span className="text-[#0f2a4e]">Welcome, {userName}</span>
        <button 
          onClick={handleLogout}
          className="text-[#0f2a4e] hover:text-red-600 transition-colors duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  )
} 