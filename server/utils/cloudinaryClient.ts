import { v2 as cloudinary } from 'cloudinary'

export function useCloudinary() {
  const { cloudName, apiKey, apiSecret } = useRuntimeConfig().cloudinary

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  })

  return cloudinary
}
