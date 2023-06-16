import WebSocketServer from './WebSocketServer.js'
import { INITIAL_PORT } from '../../common/constants.js'
import { Message } from '../../common/interfaces.js'

function main() {
	const wsServer = new WebSocketServer(INITIAL_PORT)

	wsServer.on('close', () => {
		console.log('MAIN CLOSE')
	})

	wsServer.on('message', async (sock, str) => {
		const response = `${parseMessage(str.toString())} + hi from server`
		await sock.send(response)
		// const { buffer, dataPointer } = wsServer.createFrame(response.length)
		// buffer.write(response, dataPointer)
		// wsServer.writeData(buffer)
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
