export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'folder') ?? 'tran'
  const cloudinary = useCloudinary()

  try {
    return await cloudinary.api.sub_folders(path)
  } catch (error) {
    console.error('Cloudinary sub_folders error:', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch folders from Cloudinary' })
  }
})
