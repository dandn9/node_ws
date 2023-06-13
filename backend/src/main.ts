import http from 'node:http'
import crypto from 'node:crypto'

const PORT = 3000
const HOSTNAME = '127.0.0.1'

const server = http.createServer((req, res) => {
	const STATUS_CODE = 426
	const body = http.STATUS_CODES[STATUS_CODE]
	res.writeHead(STATUS_CODE, {
		'Access-Control-Allow-Origin': 'http://localhost:5173',
		'Access-Control-Allow-Headers': '*',
		'Content-Type': 'text/plain',
		Upgrade: 'websocket',
	})
	console.log('sending', body)
	res.end(body)
})

server.on('upgrade', (req, socket, head) => {
	const requestKey = req.headers['sec-websocket-key']

	if (!requestKey) return
	const acceptKey = createAcceptKey(requestKey)
	const eol = '\r\n'
	const acceptResponse = [
		'HTTP/1.1 101 Switching Protocols',
		'Connection: Upgrade',
		'Upgrade: websocket',
		`Sec-WebSocket-Accept: ${acceptKey}`,
	]

	socket.write(acceptResponse.join(eol) + eol + eol, (err) => {
		console.log('finished', err)
	})
	socket.on('data', (data: Buffer) => {
		const encodedData = new Uint8Array(data.byteLength)
		for (let i = 0; i < data.byteLength; i++) {
			encodedData[i] = data.readUint8(i)
		}

		let messageLength = 0
		const secondByte = encodedData[1] - 128
		if (secondByte > 0 && secondByte < 125) {
			messageLength = secondByte
		} else if (secondByte === 126) {
			messageLength = data.readUint16BE(1)
		} // to continue
		console.log(messageLength, encodedData)
		/* 
        decoding algo
		 D_i = E_i XOR M_(i mod 4)

		 where D is the decoded message array,
         E is the encoded message array, M is the mask byte array,
         and i is the index of the message byte to decode.decoding algo
        */

		const decoded = new Uint8Array(messageLength)
		const mask = encodedData.slice(2, 6)
		const message = encodedData.slice(6, 6 + messageLength + 1)
		// const encoded =

		const firstByte = data.readUInt8(0)

		for (let i = 0; i < messageLength; i++) {
			decoded[i] = message[i] ^ mask[i % 4]
		}
		const result: string[] = []

		for (const char of decoded) {
			result.push(String.fromCharCode(char))
		}
		console.log(result.join(''))
	})
})
server.on('connection', (socket) => {
	console.log('connectionnnnn')
})

server.listen(PORT, HOSTNAME, () => {
	console.log('HI')
})

function createAcceptKey(reqKey: string) {
	// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
	const MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

	return crypto.createHash('sha1').update(`${reqKey}${MAGIC_STRING}`).digest('base64')
}
