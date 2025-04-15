// pages/register.tsx
import React from 'react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import { v4 as uuidv4 } from 'uuid'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('student')
  const router = useRouter()

  const handleRegister = async () => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert(error.message)
      return
    }

    // Insert vào bảng users (tùy chỉnh schema em đã có sẵn)
    const { user } = data
    if (user) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          name,
          email,
          role,
        })

      if (insertError) {
        alert(insertError.message)
        return
      }

      alert('Registered successfully!')
      router.push('/login')
    }
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Register</h2>
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} /><br />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} /><br />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /><br />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="student">Student</option>
        <option value="lecturer">Lecturer</option>
      </select><br />
      <button onClick={handleRegister}>Register</button>
    </div>
  )
}
