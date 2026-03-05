'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/interface')
    router.refresh()
  }

  return (
    <div style={{
      fontFamily: "'Times New Roman', Times, serif",
      maxWidth: 640,
      margin: '0 auto',
      padding: '2rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100vh',
    }}>
      <form onSubmit={handleLogin} style={{ maxWidth: 320 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'normal', marginBottom: '2rem', color: '#111' }}>
          Sign in
        </h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '1.125rem',
            border: '1px solid #ddd',
            marginBottom: '1rem',
            outline: 'none',
            boxSizing: 'border-box',
            color: '#111',
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '1.125rem',
            border: '1px solid #ddd',
            marginBottom: '1rem',
            outline: 'none',
            boxSizing: 'border-box',
            color: '#111',
          }}
        />
        {error && <p style={{ color: '#c00', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem 1.5rem',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '1rem',
            background: '#111',
            color: '#fff',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
