export default defineEventHandler(async (event) => {
  const { user } = (await requireUserSession(event)) as any
  const { sheets, spreadsheetId } = useGoogleSheets('readonly')

  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'order' })
    const values = response.data.values ?? []
    const userEmail = user?.email ?? 'unknown'

    return values
      .map((row: string[], index: number) => ({ row, index }))
      .filter(({ row }: { row: string[] }) => row && row.length >= 4)
      .filter(({ row }: { row: string[] }) => row[0] === userEmail)
      .map(({ row, index }: { row: string[]; index: number }) => ({
        rowNumber: index + 1,
        email: row[0] ?? '',
        name: row[1] ?? '',
        amount: Number(row[2] ?? 0) || 0,
        items: row[3] ?? '',
        time: row[4] ?? '',
        status: row[5] ?? '',
        lastFiveDigits: row[6] ?? ''
      }))
  } catch (error) {
    console.error('Error fetching orders:', error)
    throw createError({ statusCode: 500, message: 'Failed to fetch orders' })
  }
})
