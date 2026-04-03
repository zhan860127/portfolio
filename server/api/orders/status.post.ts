interface UpdateStatusBody {
  rowNumber: number
  status: string
  lastFiveDigits?: string
}

export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const { rowNumber, status, lastFiveDigits } = await readBody<UpdateStatusBody>(event)

  if (!rowNumber || rowNumber < 1) {
    throw createError({ statusCode: 400, message: 'Invalid row number' })
  }

  const { sheets, spreadsheetId } = useGoogleSheets()

  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `order!F${rowNumber}:G${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[status, lastFiveDigits ?? '']]
      }
    })

    return { success: true }
  } catch (error) {
    console.error('Error updating order status:', error)
    throw createError({ statusCode: 500, message: 'Failed to update order status' })
  }
})
