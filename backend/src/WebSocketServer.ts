import http from 'node:http'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import internal from 'node:stream'

import { HOSTNAME } from '../../common/index.js'

enum OpCodes {
	Continuation = 0,
	Text = 1,
	Binary = 2,
	ConnectionClose = 8,
	Ping = 9,
	Pong = 10,
}

interface Frame {
	buffer: Buffer
	inputOffset: number
}

class TypedEventEmitter extends EventEmitter {
	// @ts-ignore
	on(
		event: 'message',
		listener: (socketId: Socket, data: string | Uint8Array) => void
	): this
	// @ts-ignore
	on(event: 'close', listener: (socket: Socket, data: Uint8Array) => void): this
	// @ts-ignore
	on(event: 'ping', listener: (socket: Socket, data: Uint8Array) => void): this
	// @ts-ignore
	on(event: 'open', listener: (socket: Socket) => void): this
}

export default class WebSocketServer extends TypedEventEmitter {
	private serverHandle!: http.Server
	public sockets: Map<number, Socket>
	public socketCounter: number

	constructor(private port: number) {
		super()
		this.socketCounter = 0
		this.sockets = new Map()
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
			res.end(body)
		})
		this.serverHandle.on('upgrade', (req, socket, head) => {
			const socketId = ++this.socketCounter

			const sock = new Socket(req, socket, head, this.emit, socketId)
			this.sockets.set(socketId, sock)
		})
		this.serverHandle.listen(this.port, HOSTNAME, () => {
			console.log(`Server Started ${HOSTNAME}:${this.port}`)
		})
	}
}

export class Socket {
	private serverHandle!: http.Server
	private socket?: internal.Duplex
	private emit: EventEmitter['emit']
	public id: number

	constructor(
		req: http.IncomingMessage,
		socket: internal.Duplex,
		head: Buffer,
		emitter: EventEmitter['emit'],
		id: number
	) {
		this.socket = socket
		this.emit = emitter
		this.id = id

		const requestKey = req.headers['sec-websocket-key']

		if (!requestKey) return
		const acceptKey = this.createAcceptKey(requestKey)
		const eol = '\r\n'
		const acceptResponse = [
			'HTTP/1.1 101 Switching Protocols',
			'Connection: Upgrade',
			'Upgrade: websocket',
			`Sec-WebSocket-Accept: ${acceptKey}`,
		]

		socket.write(acceptResponse.join(eol) + eol + eol, (err) => {
			this.emit('open', this, err)
		})
		socket.on('data', (buffer: Buffer) => {
			const processedFrame = this.processFrame(buffer)
			if (processedFrame) {
				const { data, opCode } = processedFrame

				if (opCode === OpCodes.Text) {
					const result = this.handleText(data)
					console.log('RECEIVED TEXT ', result)
					this.emit('message', this, result)
				}
				if (opCode === OpCodes.ConnectionClose) {
					this.emit('close', this, data)
				}
				if (opCode === OpCodes.Binary) {
					this.emit('message', this, data)
				}
				if (opCode === OpCodes.Ping) {
					this.send(data, OpCodes.Pong)
					console.log('RECEIVED PING \n SENDING PONG')
					this.emit('ping', this, data)
				}
			}
		})
	}

	private async writeData(data: Buffer) {
		return new Promise<void>((resolve, reject) => {
			if (this.socket) {
				this.socket.write(data, (ws_error) => {
					if (ws_error) {
						reject(ws_error)
					} else {
						resolve()
					}
				})
			} else {
				reject(new Error('There is no socket connection'))
			}
		})
	}
	public async send(
		data: Buffer | ArrayLike<number> | string,
		opCode?: OpCodes
	): Promise<void> {
		let frame: Frame
		if (typeof data === 'string') {
			frame = this.createFrame(data.length, opCode ?? OpCodes.Text)
			frame.buffer.write(data, frame.inputOffset)
		} else {
			frame = this.createFrame(
				'byteLength' in data ? data.byteLength : data.length,
				opCode ?? OpCodes.Binary
			)
			frame.buffer.set(data, frame.buffer.byteOffset)
		}
		return await this.writeData(frame.buffer)
	}
	private createFrame(
		payloadLength: number,
		opCode: OpCodes,
		mask: boolean = false
	): Frame {
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

		console.log('WRITING', opCode)
		buffer.writeUint8(opCode + 0x80, 0) // first byte opcode
		buffer.writeUInt8(payloadValue, 1) // no mask

		if (payloadLenBytes === 3) {
			buffer.writeUInt16BE(payloadLength)
		} else if (payloadLenBytes === 9) {
			buffer.writeBigUInt64BE(BigInt(payloadLength))
		}

		return { buffer, inputOffset: payloadLenBytes + 1 }
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

		/* 
        decoding algo
		 D_i = E_i XOR M_(i mod 4)

		 where D is the decoded message array,
         E is the encoded message array, M is the mask byte array,
         and i is the index of the message byte to decode.decoding algo
        */

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
