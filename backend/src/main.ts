import WebSocketServer from './WebSocketServer.js'
import { INITIAL_PORT } from '../../common/constants.js'
import { Message } from '../../common/interfaces.js'

function main() {
	const wsServer = new WebSocketServer(INITIAL_PORT)

	wsServer.on('close', () => {
		console.log('MAIN CLOSE')
	})

	wsServer.on('message', async (sender_sock, str) => {
		if (typeof str === 'string') {
			const message = parseMessage(str)
			if (message) {
				wsServer.sockets.forEach((sock) => {
					if (sock !== sender_sock) {
						sock.send(JSON.stringify(message))
					}
				})
			}
		}
	})
}

function parseMessage(str: string): Message | null {
	const val = JSON.parse(str)
	console.log('PARSING VAL', val)
	if (val.text && val.timestamp && val.user) {
		return val as Message
	} else {
		return null
	}
}

main()
