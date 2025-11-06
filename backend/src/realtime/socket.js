import { Server } from 'socket.io';
import { config } from '../config/index.js';

let ioInstance = null;

export function initSocket(server) {
	ioInstance = new Server(server, {
		cors: { origin: config.corsOrigin.split(',') },
	});
	ioInstance.on('connection', (socket) => {
		
	});
	return ioInstance;
}

export function getIO() {
	if (!ioInstance) {
		throw new Error('Socket.IO not initialized');
	}
	return ioInstance;
}

export function emitGlobal(eventName, payload) {
	if (ioInstance) {
		ioInstance.emit(eventName, payload);
	}
}


