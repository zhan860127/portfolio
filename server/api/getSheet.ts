// server/api/getSheet.ts
import { google } from "googleapis";
import data from "../../credentials.json";

export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const spreadsheetId = query.spreadsheetId as string;
    const range = query.range as string;

    const auth = new google.auth.GoogleAuth({
        credentials: data,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    return response.data.values ?? [];
});
