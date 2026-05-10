import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'

let db: ReturnType<typeof drizzle> | null = null

export function getApiDb() {
  if (!db) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }

    const client = postgres(connectionString)
    db = drizzle(client)
  }

  return db
}

export { sql }
