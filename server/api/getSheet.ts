import { google } from "googleapis";
import { readFileSync } from "node:fs";


const config = useRuntimeConfig();

const credentialsPath = config.googleCredentialsPath;

if (!credentialsPath) {
    throw new Error("Missing Google credentials path");
}
const credentials = JSON.parse(readFileSync(credentialsPath, "utf-8"));


export default defineEventHandler(async (event) => {
    const query = getQuery(event);
    const range = query.range as string;
    const spreadsheetId = config.googleSpreadsheetId;
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: config.googleSpreadsheetId, range });

    return response.data.values ?? [];
});
