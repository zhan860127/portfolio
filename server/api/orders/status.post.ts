import { google } from "googleapis";
import { readFileSync } from "node:fs";

interface UpdateStatusBody {
  rowNumber: number;
  status: string;
  lastFiveDigits?: string;
}

export default defineEventHandler(async (event) => {
  await requireUserSession(event);

  const body = (await readBody(event)) as UpdateStatusBody;
  const { rowNumber, status, lastFiveDigits } = body;

  if (!rowNumber || rowNumber < 1) {
    throw createError({
      statusCode: 400,
      message: "Invalid row number",
    });
  }

  const config = useRuntimeConfig();

  const credentialsPath = config.googleCredentialsPath;

  if (!credentialsPath) {
    throw new Error("Missing Google credentials path");
  }

  const credentials = JSON.parse(readFileSync(credentialsPath, "utf-8"));

  if (!config.googleSpreadsheetId) {
    throw createError({
      statusCode: 500,
      message: "Google Spreadsheet ID is not configured",
    });
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const range = `order!F${rowNumber}:G${rowNumber}`; // F: status, G: last five digits

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSpreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[status, lastFiveDigits ?? ""]],
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error updating order status in Google Sheet:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to update order status",
    });
  }
});

