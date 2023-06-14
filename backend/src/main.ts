import http from 'node:http'
import crypto from 'node:crypto'
import { buffer } from 'stream/consumers'

const PORT = 8080
const HOSTNAME = '127.0.0.1'

enum OpCodes {
	Continuation = 0,
	Text = 1,
	Binary = 2,
	ConnectionClose = 8,
	Ping = 9,
	Pong = 10,
}

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

		/**
		 *
		 */
		const opCode = firstByte & 0b0000_1111
		const finBit = firstByte & 0b1000_0000

		if (finBit === 0) {
			// message is not done
			return
		}
		if (opCode === OpCodes.ConnectionClose) {
			// message is close connection

			console.log('BYE!!')
			return
		}
		if (opCode === OpCodes.Text) {
			// message is text
			console.log('is text')
		}
		if (opCode === OpCodes.Binary) {
			console.log('is binary')
		}

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
		const encodedMessage = encodedData.slice(
			reader + 4,
			reader + 4 + messageLength + 1
		)

		for (let i = 0; i < messageLength; i++) {
			decoded[i] = encodedMessage[i] ^ mask[i % 4]
		}
		const result: string[] = []

		for (const char of decoded) {
			result.push(String.fromCharCode(char))
		}
		const message = result.join('')
		console.log(message, socket.writable)
		const returnMsg = createTextMessage('hello from server')

		console.log(returnMsg)
		socket.write(returnMsg, (error) => {
			console.log('error', error)
		})
	})
})

server.listen(PORT, HOSTNAME, () => {
	console.log(`Server Started ${HOSTNAME}:${PORT}`)
})

function createTextMessage(text: string) {
	/**
      0                   1                   2                   3
      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
     +-+-+-+-+-------+-+-------------+-------------------------------+
     |F|R|R|R| opcode|M| Payload len |    Extended payload length    |
     |I|S|S|S|  (4)  |A|     (7)     |             (16/64)           |
     |N|V|V|V|       |S|             |   (if payload len==126/127)   |
     | |1|2|3|       |K|             |                               |
     +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
     |     Extended payload length continued, if payload len == 127  |
     + - - - - - - - - - - - - - - - +-------------------------------+
     |                               |Masking-key, if MASK set to 1  |
     +-------------------------------+-------------------------------+
     | Masking-key (continued)       |          Payload Data         |
     +-------------------------------- - - - - - - - - - - - - - - - +
     :                     Payload Data continued ...                :
     + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
     |                     Payload Data continued ...                |
     +---------------------------------------------------------------+


	 we won't use masking keys
	 *  
	 */
	let payloadValue = 0
	let payloadLenBytes = 1

	if (text.length > 125) {
		payloadValue = 126
		payloadLenBytes = 3
	} else if (text.length > 65535) {
		payloadValue = 127
		payloadLenBytes = 9
	} else {
		payloadValue = text.length
	}

	const buffer = Buffer.alloc(1 + payloadLenBytes + text.length)

	buffer.writeUint8(0b1000_0001, 0) // first byte opcode
	buffer.writeUInt8(payloadValue, 1) // no mask

	if (payloadLenBytes === 3) {
		buffer.writeUInt16BE(text.length)
	} else if (payloadLenBytes === 9) {
		buffer.writeBigUInt64BE(BigInt(text.length))
	}

	buffer.write(text, 1 + payloadLenBytes)

	return buffer
}
function createAcceptKey(reqKey: string) {
	// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
	const MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

	return crypto.createHash('sha1').update(`${reqKey}${MAGIC_STRING}`).digest('base64')
}
