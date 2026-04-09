import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user }  = useAuth()
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!user) return

    // Only attempt socket connection when backend is available
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3004'
    const token = localStorage.getItem('tf_token')

    // Dynamically import socket.io-client to avoid crashing in demo mode
    import('socket.io-client').then(({ io }) => {
      socketRef.current = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 3,
        timeout: 5000,
      })
      socketRef.current.on('connect',    () => setConnected(true))
      socketRef.current.on('disconnect', () => setConnected(false))
      socketRef.current.on('connect_error', () => setConnected(false))
    }).catch(() => {
      // Socket unavailable in demo mode — silent fail
    })

    return () => {
      socketRef.current?.disconnect()
      setConnected(false)
    }
  }, [user])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export const useSocket = () => useContext(SocketContext)
