import { useState, useEffect, useCallback, useRef } from 'react'

export function useWebSocket(url) {
  const [events, setEvents] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const pingIntervalRef = useRef(null)
  const lastPongRef = useRef(Date.now())

  const connect = useCallback(() => {
    // Clear any existing ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
    }

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        lastPongRef.current = Date.now()
        console.log('WebSocket connected')

        // Start ping interval - send ping every 30 seconds
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            // Check if we've received a pong recently (within 60s)
            const timeSinceLastPong = Date.now() - lastPongRef.current
            if (timeSinceLastPong > 60000) {
              // Connection seems dead, force reconnect
              console.log('WebSocket ping timeout, reconnecting...')
              ws.close()
              return
            }

            // Send ping
            try {
              ws.send(JSON.stringify({ type: 'ping' }))
            } catch (e) {
              console.error('Failed to send ping:', e)
            }
          }
        }, 30000)
      }

      ws.onclose = () => {
        setIsConnected(false)
        console.log('WebSocket disconnected, reconnecting...')
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
        }
        reconnectTimeoutRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      ws.onmessage = (event) => {
        // Update last pong time on any message (server is alive)
        lastPongRef.current = Date.now()

        try {
          const data = JSON.parse(event.data)

          // Ignore pong responses
          if (data.type === 'pong') {
            return
          }

          setLastMessage(data)
          setEvents(prev => [data, ...prev].slice(0, 100))
        } catch (e) {
          console.error('Failed to parse message:', e)
        }
      }
    } catch (e) {
      console.error('Failed to connect:', e)
      reconnectTimeoutRef.current = setTimeout(connect, 3000)
    }
  }, [url])

  // Reconnect when tab becomes visible after being hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab became visible - check if connection is still alive
        const timeSinceLastPong = Date.now() - lastPongRef.current
        if (timeSinceLastPong > 60000 || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log('Tab became visible, reconnecting WebSocket...')
          if (wsRef.current) {
            wsRef.current.close()
          }
          connect()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [connect])

  useEffect(() => {
    connect()
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
    }
  }, [connect])

  return { events, isConnected, lastMessage }
}
