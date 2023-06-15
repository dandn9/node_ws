import WebSocketServer from './WebSocketServer.js'
import { INITIAL_PORT } from '../../common/constants.js'

function main() {
	const wsServer = new WebSocketServer(INITIAL_PORT)

	wsServer.on('close', () => {
		console.log('MAIN CLOSE')
	})

	wsServer.on('message', async (sock, str) => {
		console.log('RECEIVED MESSAGE OF TYPE ', typeof str)
		const response = `${str} + hi from server`
		await sock.send(response)
		// const { buffer, dataPointer } = wsServer.createFrame(response.length)
		// buffer.write(response, dataPointer)
		// wsServer.writeData(buffer)
	})
}
main()
