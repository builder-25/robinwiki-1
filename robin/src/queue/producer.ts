import { BullMQProducer, createRedisConnection } from '@robin/queue'

// Singleton producer — shared across all route handlers
const connection = createRedisConnection()
export const producer = new BullMQProducer(connection)
