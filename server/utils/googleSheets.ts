import { google, type sheets_v4 } from 'googleapis'

type SheetsScope = 'readonly' | 'readwrite'

const SCOPES: Record<SheetsScope, string> = {
  readonly: 'https://www.googleapis.com/auth/spreadsheets.readonly',
  readwrite: 'https://www.googleapis.com/auth/spreadsheets'
}

interface GoogleSheetsClient {
  sheets: sheets_v4.Sheets
  spreadsheetId: string
}

export function useGoogleSheets(scope: SheetsScope = 'readwrite'): GoogleSheetsClient {
  const config = useRuntimeConfig()

  if (!config.googleCredentialsPath) {
    throw createError({ statusCode: 500, message: 'Missing Google credentials' })
  }

  if (!config.googleSpreadsheetId) {
    throw createError({ statusCode: 500, message: 'Google Spreadsheet ID is not configured' })
  }

  const credentials = JSON.parse(config.googleCredentialsPath)

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [SCOPES[scope]]
  })

  return {
    sheets: google.sheets({ version: 'v4', auth }),
    spreadsheetId: config.googleSpreadsheetId
  }
}
