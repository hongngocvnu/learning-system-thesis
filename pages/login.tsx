// pages/login.tsx
import React from 'react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    try {
      setIsLoading(true)
      setError('')

      // Test Supabase connection first
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(1)

      if (testError) {
        console.error('Supabase connection test failed:', testError)
        setError('Cannot connect to the server. Please check your internet connection.')
        return
      }

      // Attempt login
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (loginError) {
        console.error('Login error:', loginError)
        setError(loginError.message)
        return
      }

      if (!data?.user) {
        setError('Login failed. Please try again.')
        return
      }

      // Get user role from users table using email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, role')
        .eq('email', data.user.email)
        .single()

      if (userError) {
        console.error('Error fetching user data:', userError)
        setError('Error fetching user data')
        return
      }

      // Store user ID in session storage for later use
      sessionStorage.setItem('userId', userData.id.toString())

      // Redirect based on role
      if (userData.role === 'lecturer') {
        router.push('/dashboard-lecturer')
      } else if (userData.role === 'student') {
        router.push('/dashboard-student')
      } else {
        setError('Unknown user role')
      }
    } catch (error) {
      console.error('Unexpected error during login:', error)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Login</h2>
      {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
      <input 
        placeholder="Email" 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
        disabled={isLoading}
      /><br />
      <input 
        placeholder="Password" 
        type="password" 
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        disabled={isLoading}
      /><br />
      <button 
        onClick={handleLogin} 
        disabled={isLoading}
      >
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </div>
  )
}
