export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const range = query.range as string

  const { sheets, spreadsheetId } = useGoogleSheets('readonly')
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range })

  return response.data.values ?? []
})
