export default defineEventHandler(async () => {
  const cloudinary = useCloudinary()

  try {
    return await cloudinary.api.resources({
      type: 'upload',
      max_results: 30
    })
  } catch (error) {
    console.error('Cloudinary resources error:', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch resources from Cloudinary' })
  }
})
