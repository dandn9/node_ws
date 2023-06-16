import './style.css'
import { Message, HOSTNAME, INITIAL_PORT } from '../../common'

function createMessage(text: string, user: string): Message {
	return { text, user, timestamp: Date.now().toString() }
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
		console.log(ev)
		const Message: Message = {
			text: 'Hey there',
			timestamp: Date.now().toString(),
			user: 'Dan',
		}
		ws.send(JSON.stringify(Message))
	})
	ws.addEventListener('message', (ev: MessageEvent<Message>) => {
		console.log('message', ev)
	})

	sendBtn.addEventListener('click', (ev) => {
		if (ws.readyState === ws.OPEN) {
			const message = createMessage(textEl.value, usernameEl.value)
			ws.send(JSON.stringify(message))
		} else {
			showError('Websocket not open')
		}
	})
}

main()
