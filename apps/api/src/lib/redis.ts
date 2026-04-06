import { Redis } from 'ioredis'

function createRedis() {
  const url = process.env.REDIS_URL
  if (!url) {
    console.warn('REDIS_URL not set — using localhost')
    return new Redis({ lazyConnect: true, enableOfflineQueue: false })
  }
  return new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 3 })
}

export const redis = createRedis()
export const redisSub = createRedis()
export const redisPub = createRedis()

// Connect with error handling
async function connectAll() {
  try {
    await Promise.all([redis.connect(), redisSub.connect(), redisPub.connect()])
    console.log('Redis connected')
  } catch (e) {
    console.warn('Redis unavailable — running without pub/sub')
  }
}

connectAll()