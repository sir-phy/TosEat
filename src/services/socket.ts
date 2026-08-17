import { io, Socket } from 'socket.io-client'
import { getAccessToken } from './api.js'

let socketInstance: Socket | null = null

export const getSocket = (): Socket => {
  const token = getAccessToken()

  if (socketInstance) {
    if (socketInstance.connected) {
      return socketInstance
    }
  }

  const origin = window.location.origin

  socketInstance = io(origin, {
    auth: {
      token: token || ''
    },
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  })

  socketInstance.on('connect', () => {
    console.log('⚡ Connected to GoMeal Real-Time Socket.IO Server [ID:', socketInstance?.id, ']')
  })

  socketInstance.on('connect_error', (err) => {
    console.warn('Socket connect error:', err.message)
  })

  socketInstance.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason)
  })

  return socketInstance
}

export const joinTableRoom = (tableId: number | string): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = getSocket()
    if (!tableId) return resolve(false)
    socket.emit('join:table', tableId, (res: { ok: boolean }) => {
      resolve(res ? res.ok : true)
    })
  })
}

export const joinOrderRoom = (orderId: number | string): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = getSocket()
    if (!orderId) return resolve(false)
    socket.emit('join:order', orderId, (res: { ok: boolean }) => {
      resolve(res ? res.ok : true)
    })
  })
}

export const joinCashierRoom = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = getSocket()
    socket.emit('join:cashier', {}, (res: { ok: boolean }) => {
      resolve(res ? res.ok : true)
    })
  })
}

export const joinKitchenRoom = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = getSocket()
    socket.emit('join:kitchen', {}, (res: { ok: boolean }) => {
      resolve(res ? res.ok : true)
    })
  })
}

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
