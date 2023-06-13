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
		// const encodedData = new Uint8Array(data.byteLength)
		const encodedData = new Uint8Array(data)
		let reader = 0

		console.log('ON DATA')
		const firstByte = data.readUint8(reader++)
		console.log(firstByte)

		// if ((firstByte & 0b1001_0000) != 0) {
		// 	// message is close connection
		// 	console.log('BYE!!')
		// 	return
		// }
		// if ((firstByte & 0b0000_0001) != 1) {
		// 	// full message has not been sent
		// 	return
		// }
		// if ((firstByte & 0b1000_0000) != 0) {
		// 	// message is text
		// 	console.log('is text')
		// }
		// if ((firstByte & 0b0100_0000) != 0) {
		// 	// message is binary
		// 	console.log('DONT SUPPORT BINARY YET')
		// 	return
		// }
		console.log('DATA')
		const secondByte = data.readUint8(reader++)
		const lengthValue = secondByte - 128

		let messageLength: number = 0
		if (lengthValue > 0 && lengthValue < 125) {
			messageLength = lengthValue
		} else if (lengthValue === 126) {
			messageLength = data.readUInt16BE(reader)
			reader = 4
		} else if (lengthValue === 127) {
			const val = data.readBigUInt64BE(reader)
			if (val > Number.MAX_SAFE_INTEGER) {
				// do something because payload is way too big
				return
			}
			messageLength = parseInt(val.toString())
			reader = 10
		} // to continue

		console.log(messageLength, encodedData)

		/* 
        decoding algo
		 D_i = E_i XOR M_(i mod 4)

		 where D is the decoded message array,
         E is the encoded message array, M is the mask byte array,
         and i is the index of the message byte to decode.decoding algo
        */

		console.log('READER', reader)
		const decoded = new Uint8Array(messageLength)
		const mask = encodedData.slice(reader, reader + 4)
		console.log(mask)
		const message = encodedData.slice(reader + 4, reader + 4 + messageLength + 1)
		// const encoded =

		for (let i = 0; i < messageLength; i++) {
			decoded[i] = message[i] ^ mask[i % 4]
		}
		const result: string[] = []

		for (const char of decoded) {
			result.push(String.fromCharCode(char))
		}
		console.log(result)
		console.log(result.join(''))
	})
})

server.listen(PORT, HOSTNAME, () => {
	console.log(`Server Started ${HOSTNAME}:${PORT}`)
})

function createAcceptKey(reqKey: string) {
	// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
	const MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

	return crypto.createHash('sha1').update(`${reqKey}${MAGIC_STRING}`).digest('base64')
}
