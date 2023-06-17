import './style.css'
import { Message, HOSTNAME, INITIAL_PORT } from '../../common'

function createMessage(text: string, user: string): Message {
	return { text, user, timestamp: new Date().getTime().toString() }
}
function addMessage(message: Message, own: boolean) {
	const chatBox = document.querySelector('#chat') as HTMLDivElement
	chatBox.innerHTML += `
	<div class="chat-message ${own ? 'own' : ''}"><span>From: ${
		message.user
	}</span><span> At: ${new Date(
		parseInt(message.timestamp)
	).toLocaleTimeString()}</span>
	<p>${message.text}</p></div>`
}

function showError(text: string) {
	const err = document.querySelector('.error') as HTMLParagraphElement
	err.innerHTML = text
	err.classList.remove('hidden')
	setTimeout(() => {
		err.classList.add('hidden')
	}, 2000)
}

function main() {
	// try {
	// 	const response = await fetch(`http://${HOSTNAME}:${PORT}`)
	// 	console.log(response.statusText)
	// } catch (e) {
	// 	console.log(e)
	// }

	const usernameEl = document.querySelector('#username') as HTMLInputElement
	const textEl = document.querySelector('#text') as HTMLTextAreaElement
	const sendBtn = document.querySelector('#sendbtn') as HTMLButtonElement

	const ws = new WebSocket(`ws://${HOSTNAME}:${INITIAL_PORT}`)

	ws.addEventListener('error', (ev) => {
		console.log('error', ev)
	})
	ws.addEventListener('close', (ev) => {
		console.log('close', ev)
	})

	ws.addEventListener('open', (ev) => {
		const message = createMessage('A new user joined', '')
		ws.send(JSON.stringify(message))
	})
	ws.addEventListener('message', (ev) => {
		const data = JSON.parse(ev.data)
		const message = createMessage(data.text, data.user)

		addMessage(message, false)
	})

	sendBtn.addEventListener('click', (ev) => {
		if (ws.readyState === ws.OPEN) {
			const message = createMessage(textEl.value, usernameEl.value)
			ws.send(JSON.stringify(message))
			addMessage(message, true)
		} else {
			showError('Websocket not open')
		}
	})
}

main()
