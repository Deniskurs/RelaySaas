import { useState, useCallback } from 'react'

const API_BASE = '/api'

export function useApi() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchData = useCallback(async (endpoint) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}${endpoint}`)
      if (!response.ok) throw new Error('API request failed')
      return await response.json()
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const postData = useCallback(async (endpoint, data = {}) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('API request failed')
      return await response.json()
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { fetchData, postData, loading, error }
}
