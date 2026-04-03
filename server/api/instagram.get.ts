// /server/api/instagram.ts
interface InstagramOEmbedResponse {
  html: string
  author_name?: string
  author_url?: string
  provider_name?: string
  provider_url?: string
  type?: string
  version?: string
  width?: number
  height?: number
}

interface InstagramPost {
  url: string
  html: string
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig()
  const postUrls = [
    'https://www.instagram.com/p/DJRQsvxTOux/',
    'https://www.instagram.com/p/DJHLgQUT6wU/',
    'https://www.instagram.com/p/DA_RlB5zzTs/',
    'https://www.instagram.com/p/DA5vagrzydt/',
    'https://www.instagram.com/p/DA3Zs4GzIkx/',
    'https://www.instagram.com/p/DAvwN2lzGyA/',
    'https://www.instagram.com/p/DAqRYzDzZb4/',
    'https://www.instagram.com/p/DAlKzY9TpHB/',
    'https://www.instagram.com/p/DAgEkwoz-Cq/',
    'https://www.instagram.com/p/DAdkaXAzv4R/'
  ]

  const posts: InstagramPost[] = await Promise.all(
    postUrls.map(async (url) => {
      try {
        const response = await $fetch(`https://graph.facebook.com/v25.0/instagram_oembed`, {
          params: {
            url: url,
            omitscript: 'true',
            access_token: config.instagramAccessToken
          }
        })
        return {
          url,
          html: (response as InstagramOEmbedResponse).html
        }
      } catch (err) {
        console.error(`Failed to fetch oEmbed for ${url}`, err)
        return null
      }
    })
  ).then((res) => res.filter(Boolean) as InstagramPost[])

  return { posts }
})