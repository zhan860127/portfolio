export default defineEventHandler(async (event) => {
  const { user } = (await requireUserSession(event)) as any
  const { sheets, spreadsheetId } = useGoogleSheets('readonly')

  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'order' })
    const values = response.data.values ?? []
    const userEmail = user?.email ?? 'unknown'

    return values
      .map((row: string[], index: number) => ({ row, index }))
      .filter(({ row }: { row: string[] }) => row && row.length >= 5)
      .filter(({ row }: { row: string[] }) => row[1] === userEmail)
      .map(({ row, index }: { row: string[]; index: number }) => ({
        rowNumber: index + 1,
        orderId: row[0] ?? '',
        email: row[1] ?? '',
        name: row[2] ?? '',
        amount: Number(row[3] ?? 0) || 0,
        items: row[4] ?? '',
        time: row[5] ?? '',
        status: row[6] ?? '',
        lastFiveDigits: row[7] ?? ''
      }))
  } catch (error) {
    console.error('Error fetching orders:', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch orders' })
  }
})
