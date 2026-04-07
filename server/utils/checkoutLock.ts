import { Redis } from '@upstash/redis'

const LOCK_TTL_MS = 10_000
const RETRY_DELAY_MS = 100
const MAX_RETRIES = 30

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis

  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) return null

  _redis = new Redis({ url, token })
  return _redis
}

function generateLockId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export interface LockHandle {
  lockId: string
  keys: string[]
}

/**
 * Acquire per-product locks for checkout.
 * Product IDs are sorted before locking to avoid deadlocks.
 * Returns a LockHandle on success, or null if KV is not configured (dev fallback).
 * Throws if lock cannot be acquired within the retry window.
 */
export async function acquireProductLocks(productIds: string[]): Promise<LockHandle | null> {
  const redis = getRedis()
  if (!redis) return null

  const lockId = generateLockId()
  const sortedIds = [...new Set(productIds)].sort()
  const acquiredKeys: string[] = []

  for (const id of sortedIds) {
    const key = `checkout-lock:${id}`
    let acquired = false

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const result = await redis.set(key, lockId, { nx: true, px: LOCK_TTL_MS })
      if (result === 'OK') {
        acquired = true
        acquiredKeys.push(key)
        break
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
    }

    if (!acquired) {
      await releaseProductLocks({ lockId, keys: acquiredKeys })
      throw createError({ statusCode: 409, message: '系統忙碌中，請稍後再試' })
    }
  }

  return { lockId, keys: acquiredKeys }
}

/**
 * Release locks only if they still belong to this request (safe unlock).
 * Uses Lua script for atomicity.
 */
export async function releaseProductLocks(handle: LockHandle | null): Promise<void> {
  if (!handle) return

  const redis = getRedis()
  if (!redis) return

  const script = `if redis.call("get",KEYS[1])==ARGV[1] then return redis.call("del",KEYS[1]) else return 0 end`

  await Promise.allSettled(
    handle.keys.map(key => redis.eval(script, [key], [handle.lockId]))
  )
}
