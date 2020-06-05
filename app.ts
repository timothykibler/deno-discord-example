import {
  connectWebSocket,
  isWebSocketCloseEvent
} from 'https://deno.land/std/ws/mod.ts'
import { encode } from 'https://deno.land/std/encoding/utf8.ts'
import { BufReader } from 'https://deno.land/std/io/bufio.ts'
import { TextProtoReader } from 'https://deno.land/std/textproto/mod.ts'
import { blue, green, red, yellow } from 'https://deno.land/std/fmt/colors.ts'

import { API_ENDPOINT, BOT_TOKEN, CHANNEL_ID, COMMAND, SUB_COMMAND, DISCORD_WSS, FIND_ENDPOINT, API_KEY } from './inc/config.ts'

let current_sequence: number

async function createBotMessage(content: string) {

  const url = new URL(`${API_ENDPOINT}/channels/${CHANNEL_ID}/messages`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      content
    })
  })

  console.log(await response.json())

  return
}

// duplicate this for more commands I guess??
async function isCommand(content: string = '') {
  return content.includes(`/${COMMAND} ${SUB_COMMAND}`)
}

async function apiRequest(content: string = '') {
  // might as well split on the sub_command
  const [ , query ] = content.split(SUB_COMMAND)
  const text = query.trim()
  console.log(blue(`api query: ${text}`))

  // fetch apiRequest
  const url = new URL(FIND_ENDPOINT)

  url.search = new URLSearchParams({
    key: API_KEY,
    text
  }).toString()

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json'
    }
  }).catch(e => {
    throw e
  })

  return await response.json()
}

// const GATEWAY_INFO = await getGateway()

const sock = await connectWebSocket(DISCORD_WSS)
console.log(green(`connected successfully to ${DISCORD_WSS}`))

await sock.send(JSON.stringify({
  op: 2,
  d: {
    token: BOT_TOKEN,
    properties: {
      '$os': 'windows',
      '$browser': 'deno',
      '$device': 'desktop'
    }
  },
  s: null,
  t: null,
  intents: (1 << 9)
}))

console.log(green(`identified successfully!`))

async function messages() {

  for await (const msg of sock) {
    if (typeof msg === 'string') {
      console.log(yellow(`< ${msg}`))

      const { t, d, op, s } = JSON.parse(msg)

      current_sequence = s

      // ready msg
      if (op === 0) {

        if (t === 'MESSAGE_CREATE') {
          const is_command = await isCommand(d.content)

          if (is_command) {
            const { Items = [] } = await apiRequest(d.content)
            // send results to chat!
            await createBotMessage(JSON.stringify(Items))

          }

        }

        console.log(green(`current_sequence: ${current_sequence}`))
      }

      // start sending heartbeat
      if (op === 10) {
        const { heartbeat_interval = 60000 } = d

        try {

          setInterval(async () => {
            console.log(green('sending heartbeat'))

            await sock.send(JSON.stringify({
              op: 1,
              d: {},
              s: current_sequence,
              t: 'HEARTBEAT'
            }))
          }, heartbeat_interval)

        } catch(e) {
          throw e
        }

      }

      if (op === 11) {
        console.log(blue(`heartbeat ACK received`))
      }

    } else if (isWebSocketCloseEvent(msg)) {
      console.log(red(`closed: code=${msg.code}, reason=${msg.reason}`))
    }
  }

}

async function cli() {
  const tpr = new TextProtoReader(new BufReader(Deno.stdin))

  while (true) {
    await Deno.stdout.write(encode('> '))
    const line = await tpr.readLine()

    if (line === null || line === 'close') {
      break
    }
  }
}

await Promise.race([ messages(), cli() ]).catch(console.error)

// close the socket
if (!sock.isClosed) {
  await sock.close(10000).catch(console.error)
}

Deno.exit(0)
