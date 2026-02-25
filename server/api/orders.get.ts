import { google } from "googleapis";
import { readFileSync } from "node:fs";

export default defineEventHandler(async (event) => {
  const { user } = (await requireUserSession(event)) as any;
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
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.googleSpreadsheetId,
      range: "order",
    });

    const values = response.data.values ?? [];

    const userEmail = user?.email ?? "unknown";

    const orders = values
      .filter((row) => row && row.length >= 4)
      .filter((row) => row[0] === userEmail)
      .map((row) => ({
        email: row[0] ?? "",
        name: row[1] ?? "",
        amount: Number(row[2] ?? 0) || 0,
        items: row[3] ?? "",
        time: row[4] ?? "",
      }));

    return orders;
  } catch (error) {
    console.error("Error fetching orders from Google Sheet:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch orders",
    });
  }
}
)
