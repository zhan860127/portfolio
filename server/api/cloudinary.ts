import { v2 as cloudinary } from 'cloudinary'

export default defineEventHandler(async (event) => {
  
  const config = useRuntimeConfig().cloudinary

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  })
  
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      max_results: 30,
    })

    
    return result
  } catch (error) {
    
    
    return { error: 'Failed to fetch resources from Cloudinary' }
  }
})
