import { google } from "googleapis";
import { readFileSync } from "node:fs";

export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event) as any;
    const body = await readBody(event);
    const { amount, items } = body;

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

    const itemsSummary = items.map((item: any) => `${item.title} *${item.quantity}`).join("\n");
    const orderTime = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: config.googleSpreadsheetId,
            range: "order",
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [
                    [
                        user?.email ?? "unknown",
                        user?.name ?? "unknown",
                        amount,
                        itemsSummary,
                        orderTime,
                        "Pending Payment"
                    ]
                ],
            },
        });
        return { success: true };
    } catch (error) {
        console.error("Error appending to Google Sheet:", error);
        throw createError({
            statusCode: 500,
            message: "Failed to record order",
        });
    }
});
