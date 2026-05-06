const INSTAGRAM_GRAPH_BASE = 'https://graph.instagram.com/v25.0'
const DEFAULT_POST_LIMIT = 6

type GraphError = {
  error?: {
    message?: string
    code?: number
  }
}

type InstagramMeResponse = {
  id?: string
  username?: string
}

type InstagramMediaNode = {
  id: string
  caption?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
}

type InstagramMediaResponse = {
  data?: InstagramMediaNode[]
}

interface InstagramHomePost {
  id: string
  url: string
  authorName: string
  providerName: string
  mediaType?: string
  mediaUrl?: string
  thumbnailUrl?: string
  caption?: string
  timestamp?: string
}

function parseGraphError(err: unknown): { message: string, code?: number } {
  if (err && typeof err === 'object') {
    const payload = err as {
      data?: GraphError
      response?: { _data?: GraphError }
    }

    const graphError = payload.data?.error || payload.response?._data?.error
    if (graphError?.message) {
      return {
        message: graphError.message,
        code: graphError.code
      }
    }
  }

  if (err instanceof Error) {
    return { message: err.message }
  }

  return { message: String(err) }
}

function toHomePost(post: InstagramMediaNode, username: string): InstagramHomePost | null {
  if (!post.id || !post.permalink) {
    return null
  }

  return {
    id: post.id,
    url: post.permalink,
    authorName: username || 'tranquil._.island',
    providerName: 'Instagram',
    mediaType: post.media_type,
    mediaUrl: post.media_url,
    thumbnailUrl: post.thumbnail_url,
    caption: post.caption,
    timestamp: post.timestamp
  }
}

function toTimestampValue(value?: string): number {
  if (!value) return 0
  const ts = Date.parse(value)
  return Number.isNaN(ts) ? 0 : ts
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const token = typeof config.instagramAccessToken === 'string' ? config.instagramAccessToken.trim() : ''

  if (!token) {
    return {
      posts: [],
      configured: false as const,
      error: 'missing_token' as const,
      source: 'instagram_graph_media' as const
    }
  }

  try {
    const profile = await $fetch<InstagramMeResponse>(`${INSTAGRAM_GRAPH_BASE}/me`, {
      params: {
        fields: 'id,username',
        access_token: token
      },
      timeout: 8000
    })

    const media = await $fetch<InstagramMediaResponse>(`${INSTAGRAM_GRAPH_BASE}/me/media`, {
      params: {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
        limit: DEFAULT_POST_LIMIT,
        access_token: token
      },
      timeout: 8000
    })

    const author = profile.username || config.instagramOwnerUsername || 'tranquil._.island'
    const posts = (media.data || [])
      .map(post => toHomePost(post, author))
      .filter((post): post is InstagramHomePost => Boolean(post))
      .sort((a, b) => toTimestampValue(b.timestamp) - toTimestampValue(a.timestamp))
      .slice(0, DEFAULT_POST_LIMIT)

    return {
      posts,
      configured: true as const,
      source: 'instagram_graph_media' as const
    }
  } catch (err) {
    const { message, code } = parseGraphError(err)
    console.warn('[instagram] failed to fetch Instagram media with access token.', { message, code })

    return {
      posts: [],
      configured: true as const,
      error: message,
      code,
      source: 'instagram_graph_media' as const
    }
  }
})
