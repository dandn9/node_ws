import WebSocketServer from './WebSocketServer.js'
import { INITIAL_PORT } from '../../common/constants.js'

function main() {
	const wsServer = new WebSocketServer(INITIAL_PORT)
	wsServer.on('message', (str: string) => {
		const response = `${str} + hi from server`
		wsServer.send(response, (err) => {
			console.log('SENT RESPONSE')
		})
		// const { buffer, dataPointer } = wsServer.createFrame(response.length)
		// buffer.write(response, dataPointer)
		// wsServer.writeData(buffer)
	})
}
main()
