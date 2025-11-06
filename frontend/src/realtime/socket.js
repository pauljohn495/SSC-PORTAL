import { io } from 'socket.io-client'

let socket

export function getSocket() {
	if (!socket) {
		const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'
		const serverUrl = apiBase.replace(/\/api\/?$/, '')
		socket = io(serverUrl, { transports: ['websocket'], autoConnect: true })
	}
	return socket
}

export function onEvent(event, handler) {
	const s = getSocket()
	s.on(event, handler)
	return () => s.off(event, handler)
}


