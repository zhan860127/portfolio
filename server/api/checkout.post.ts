import { google } from "googleapis";

export default defineEventHandler(async (event) => {
    const { user } = await requireUserSession(event) as any;
    const body = await readBody(event);
    const { amount, items } = body;

    const config = useRuntimeConfig();

    const credentialsPath = config.googleCredentialsPath;

    if (!credentialsPath) {
        throw new Error("Missing Google credentials path");
    }
    const credentials = JSON.parse(credentialsPath);

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
    const spreadsheetId = config.googleSpreadsheetId;

    // 1. Read product sheet to check stock
    const productRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "product",
    });

    const rows = productRes.data.values;
    if (!rows || rows.length < 2) {
        throw createError({ statusCode: 500, message: "Product sheet is empty" });
    }

    const headers = rows[0].map((h: string) => h.toLowerCase().replace(" ", "_"));
    const idCol = headers.indexOf("id");
    const qtyCol = headers.indexOf("quantity");

    if (idCol === -1 || qtyCol === -1) {
        throw createError({ statusCode: 500, message: "Product sheet missing id or quantity column" });
    }

    // 2. Build a map: productId -> { rowIndex (0-based in sheet), stock }
    const stockMap = new Map<string, { rowIndex: number; stock: number }>();
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        stockMap.set(String(row[idCol]), {
            rowIndex: i,
            stock: Number(row[qtyCol]) || 0,
        });
    }

    // 3. Validate stock for every cart item
    const outOfStock: string[] = [];
    for (const item of items) {
        const entry = stockMap.get(String(item.id));
        if (!entry) {
            outOfStock.push(`${item.title}（商品不存在）`);
        } else if (item.quantity > entry.stock) {
            outOfStock.push(`${item.title}（庫存 ${entry.stock}，需求 ${item.quantity}）`);
        }
    }

    if (outOfStock.length > 0) {
        throw createError({
            statusCode: 400,
            message: `庫存不足：${outOfStock.join("、")}`,
        });
    }

    // 4. Deduct quantities — batch update
    const dataToUpdate = items.map((item: any) => {
        const entry = stockMap.get(String(item.id))!;
        const sheetRow = entry.rowIndex + 1; // 1-based for A1 notation
        const colLetter = String.fromCharCode(65 + qtyCol); // A=0, B=1 ...
        return {
            range: `product!${colLetter}${sheetRow}`,
            values: [[entry.stock - item.quantity]],
        };
    });

    try {
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId,
            requestBody: {
                valueInputOption: "USER_ENTERED",
                data: dataToUpdate,
            },
        });
    } catch (error) {
        console.error("Error updating product stock:", error);
        throw createError({ statusCode: 500, message: "Failed to update stock" });
    }

    // 5. Append order row
    const itemsSummary = items.map((item: any) => `${item.title} *${item.quantity}`).join("\n");
    const orderTime = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
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
                        "Pending Payment",
                    ],
                ],
            },
        });
        return { success: true };
    } catch (error) {
        console.error("Error appending to Google Sheet:", error);
        throw createError({ statusCode: 500, message: "Failed to record order" });
    }
});
