import './style.css'
import { Message, HOSTNAME, INITIAL_PORT } from '../../common'

async function main() {
	// try {
	// 	const response = await fetch(`http://${HOSTNAME}:${PORT}`)
	// 	console.log(response.statusText)
	// } catch (e) {
	// 	console.log(e)
	// }

	const ws = new WebSocket(`ws://${HOSTNAME}:${INITIAL_PORT}`)

	ws.addEventListener('error', (ev) => {
		console.log('error', ev)
	})
	ws.addEventListener('close', (ev) => {
		console.log('close', ev)
	})

	ws.addEventListener('open', (ev) => {
		console.log('open', ev)
		const pl = 'Hi From client'
		console.log('LEN', pl.length)
		ws.send(pl)
	})
	ws.addEventListener('message', (ev: MessageEvent<Message>) => {
		console.log('message', ev)
	})
}

main()
