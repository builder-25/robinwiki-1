import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL env var is required')
const sql = postgres(process.env.DATABASE_URL)
export const db = drizzle(sql, { schema })
export type DB = typeof db
