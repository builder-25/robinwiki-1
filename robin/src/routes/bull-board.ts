import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { HonoAdapter } from '@bull-board/hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { Queue, createRedisConnection, QUEUE_NAMES } from '@robin/queue'

const connection = createRedisConnection()

const serverAdapter = new HonoAdapter(serveStatic)
serverAdapter.setBasePath('/admin/queues')

const staticQueues = [
  new Queue(QUEUE_NAMES.provision, { connection }),
  new Queue(QUEUE_NAMES.scheduler, { connection }),
  new Queue(QUEUE_NAMES.dlq, { connection }),
]

const board = createBullBoard({
  queues: staticQueues.map((q) => new BullMQAdapter(q)),
  serverAdapter,
})

// Auto-discover per-user queues from Redis
const discovered = new Set<string>()

async function discoverQueues() {
  try {
    const keys = await connection.keys('bull:*:meta')
    for (const key of keys) {
      const name = key.split(':')[1]
      if (!name || discovered.has(name)) continue
      discovered.add(name)
      board.addQueue(new BullMQAdapter(new Queue(name, { connection })))
    }
  } catch {
    // Redis may not be ready yet
  }
}

setInterval(discoverQueues, 10_000)
discoverQueues()

const bullBoardApp = serverAdapter.registerPlugin()

export { bullBoardApp }
