// pages/login.tsx
import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Login() {
  const [activeTab, setActiveTab] = useState<'student' | 'lecturer'>('student')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleTabChange = (tab: 'student' | 'lecturer') => {
    setActiveTab(tab)
    setEmail('')
    setPassword('')
    setError('')
  }

  const handleLogin = async () => {
    try {
      setIsLoading(true)
      setError('')
      // Attempt login
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (loginError || !data?.user) {
        setError('Incorrect email or password.')
        setEmail('')
        setPassword('')
        return
      }
      // Get user role from users table using email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('email', data.user.email)
        .single()
      if (userError || !userData) {
        setError('Error fetching user data')
        setEmail('')
        setPassword('')
        return
      }
      // Store user ID in session storage for later use
      sessionStorage.setItem('userId', userData.id.toString())
      // Redirect based on role and tab
      if (userData.role === 'lecturer' && activeTab === 'lecturer') {
        router.push('/dashboard-lecturer')
      } else if (userData.role === 'student' && activeTab === 'student') {
        router.push('/dashboard-student')
      } else {
        if (activeTab === 'lecturer' && userData.role === 'student') {
          setError('Account permission denied.')
        } else {
          setError('Incorrect email or password.')
        }
        setEmail('')
        setPassword('')
      }
    } catch (error) {
      setError('An unexpected error occurred. Please try again.')
      setEmail('')
      setPassword('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img 
            src="/img/vnuislogo-2.png" 
            alt="School Logo" 
            className="h-24 w-auto mb-6"
          />
        </div>
        <div className="flex justify-center mb-8">
          <div className="flex bg-gray-100 rounded-full p-1 w-full max-w-xs">
            <button
              className={`flex-1 py-2 rounded-full font-semibold transition-colors text-sm ${activeTab === 'student' ? 'bg-[#0f2a4e] text-white shadow' : 'text-[#0f2a4e] hover:bg-blue-100'}`}
              onClick={() => handleTabChange('student')}
              type="button"
            >
              Student Login
            </button>
            <button
              className={`flex-1 py-2 rounded-full font-semibold transition-colors text-sm ${activeTab === 'lecturer' ? 'bg-[#0f2a4e] text-white shadow' : 'text-[#0f2a4e] hover:bg-blue-100'}`}
              onClick={() => handleTabChange('lecturer')}
              type="button"
            >
              Lecturer Login
            </button>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#0f2a4e] mb-6 text-center">{activeTab === 'student' ? 'Student Login' : 'Lecturer Login'}</h2>
        <form
          onSubmit={e => {
            e.preventDefault();
            handleLogin();
          }}
        >
          <div className="mb-4">
            <label className="block text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2a4e]"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
            />
          </div>
          <div className="mb-2">
            <label className="block text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2a4e]"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>
          {error && <div className="text-red-600 text-sm mb-4 mt-1">{error}</div>}
          <button
            type="submit"
            className="w-full mt-2 bg-[#0f2a4e] text-white py-2 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}
