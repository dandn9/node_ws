import http, { Server } from 'node:http'
import crypto from 'node:crypto'
import { buffer } from 'stream/consumers'
import { EventEmitter } from 'node:events'
import internal from 'node:stream'

const HOSTNAME = '127.0.0.1'

enum OpCodes {
	Continuation = 0,
	Text = 1,
	Binary = 2,
	ConnectionClose = 8,
	Ping = 9,
	Pong = 10,
}

class WebSocketServer extends EventEmitter {
	private serverHandle!: http.Server
	private socket?: internal.Duplex

	constructor(private port: number) {
		super()
		this.createServer()
	}

	private createServer() {
		this.serverHandle = http.createServer((req, res) => {
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
		this.serverHandle.on('upgrade', this.handleSocket.bind(this))
		this.serverHandle.listen(this.port, HOSTNAME, () => {
			console.log(`Server Started ${HOSTNAME}:${this.port}`)
		})
	}

	private handleSocket(
		req: http.IncomingMessage,
		socket: internal.Duplex,
		head: Buffer
	) {
		const requestKey = req.headers['sec-websocket-key']

		if (!requestKey) return
		console.log(this)
		const acceptKey = this.createAcceptKey(requestKey)
		const eol = '\r\n'
		const acceptResponse = [
			'HTTP/1.1 101 Switching Protocols',
			'Connection: Upgrade',
			'Upgrade: websocket',
			`Sec-WebSocket-Accept: ${acceptKey}`,
		]

		socket.write(acceptResponse.join(eol) + eol + eol, (err) => {
			this.emit('connected', err)
		})
		socket.on('data', (buffer: Buffer) => {
			const processedFrame = this.processFrame(buffer)
			if (processedFrame) {
				const { data, opCode } = processedFrame

				if (opCode === OpCodes.Text) {
					const result = this.handleText(data)
					this.emit('message', result)

					// const returnMsg = createTextMessage(`${result} + hello from server`)

					// console.log(returnMsg)
					// socket.write(returnMsg, (error) => {
					// 	console.log('error', error)
					// })
				}
			}
		})
		this.socket = socket
	}
	public writeData(data: Buffer, callback?: (err: Error | null | undefined) => any) {
		if (this.socket) {
			this.socket.write(data, callback)
		}
	}
	public createFrame(
		payloadLength: number,
		mask: boolean = false
	): { buffer: Buffer; dataPointer: number } {
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

		if (payloadLength > 125) {
			payloadValue = 126
			payloadLenBytes = 3
		} else if (payloadLength > 65535) {
			payloadValue = 127
			payloadLenBytes = 9
		} else {
			payloadValue = payloadLength
		}

		const buffer = Buffer.alloc(1 + payloadLenBytes + payloadLength)

		buffer.writeUint8(0b1000_0001, 0) // first byte opcode
		buffer.writeUInt8(payloadValue, 1) // no mask

		if (payloadLenBytes === 3) {
			buffer.writeUInt16BE(payloadLength)
		} else if (payloadLenBytes === 9) {
			buffer.writeBigUInt64BE(BigInt(payloadLength))
		}

		return { buffer, dataPointer: payloadLenBytes + 1 }
	}

	private processFrame(
		data: Buffer
	): { data: Uint8Array; opCode: OpCodes } | undefined {
		const encodedData = new Uint8Array(data)
		let reader = 0

		console.log('PROCESSING FRAME')
		const firstByte = data.readUint8(reader++)

		const opCode = firstByte & 0b0000_1111 // 0xF
		const finBit = firstByte & 0b1000_0000 // 0x80

		if (finBit === 0) {
			// message is not done
			return
		}

		const secondByte = data.readUint8(reader++)
		const hasMask = Boolean(secondByte & 0b1000_0000)
		const lengthValue = secondByte & 0b0111_1111

		let payloadLength: number = lengthValue
		if (lengthValue === 126) {
			payloadLength = data.readUInt16BE(reader)
			reader = 4
		} else if (lengthValue === 127) {
			const val = data.readBigUInt64BE(reader)
			if (val > Number.MAX_SAFE_INTEGER) {
				// do something because payload is way too big
				return
			}
			payloadLength = parseInt(val.toString())
			reader = 10
		}

		console.log(payloadLength, encodedData)

		/* 
        decoding algo
		 D_i = E_i XOR M_(i mod 4)

		 where D is the decoded message array,
         E is the encoded message array, M is the mask byte array,
         and i is the index of the message byte to decode.decoding algo
        */

		console.log('READER', reader)
		const decodedMessage = new Uint8Array(payloadLength)
		const maskOffset = hasMask ? 4 : 0

		if (hasMask) {
			const mask = encodedData.slice(reader, reader + 4)
			for (let i = 0; i < payloadLength; i++) {
				decodedMessage[i] = encodedData[i + reader + maskOffset] ^ mask[i % 4]
			}
		} else {
			for (let i = 0; i < payloadLength; i++) {
				decodedMessage[i] = encodedData[i + reader + maskOffset]
			}
		}

		return { data: decodedMessage, opCode }

		// for (const char of decoded) {
		// 	result.push(String.fromCharCode(char))
		// }
		// const message = result.join('')
	}
	private handleText(data: Uint8Array): string {
		const result: string[] = []
		for (const char of data) {
			result.push(String.fromCharCode(char))
		}
		return result.join('')
	}
	private handleBinary() {}
	private handlePing() {}
	private createAcceptKey(reqKey: string) {
		// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers
		const MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

		return crypto
			.createHash('sha1')
			.update(`${reqKey}${MAGIC_STRING}`)
			.digest('base64')
	}
}

function main() {
	const wsServer = new WebSocketServer(8080)
	wsServer.on('message', (str: string) => {
		const response = `${str} + hi from server`
		const { buffer, dataPointer } = wsServer.createFrame(response.length)
		buffer.write(response, dataPointer)
		wsServer.writeData(buffer)
	})
}
main()
