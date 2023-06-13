import './style.css'

const HOSTNAME = 'localhost'
const PORT = 3000

async function main() {
	// try {
	// 	const response = await fetch(`http://${HOSTNAME}:${PORT}`)
	// 	console.log(response.statusText)
	// } catch (e) {
	// 	console.log(e)
	// }

	const ws = new WebSocket(`ws://${HOSTNAME}:${PORT}`)

	ws.addEventListener('error', (ev) => {
		console.log('error', ev)
	})
	ws.addEventListener('close', (ev) => {
		console.log('close', ev)
	})
	ws.addEventListener('open', (ev) => {
		console.log('open', ev)
		ws.send('MDNxd')
	})
	ws.addEventListener('message', (ev) => {
		console.log('message', ev)
	})
}

main()
