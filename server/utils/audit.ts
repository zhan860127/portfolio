import { auditLogs } from '../database/schema'

export type AuditAction
  = | 'market.create'
    | 'market.update'
    | 'market.publish'
    | 'market.unpublish'
    | 'product.create'
    | 'product.update'
    | 'product.delete'
    | 'product.reorder'
    | 'order.confirm_deposit'
    | 'order.confirm_sold'
    | 'order.cancel'
    | 'order.mark_expired'
    | 'waitlist.notify'
    | 'waitlist.promote'
    | 'waitlist.cancel'
    | 'shipping.mark_shipped'
    | 'shipping.cancel'
    | 'user.set_role'

export interface AuditInput {
  actorId: string | null
  action: AuditAction
  entityType: 'market' | 'product' | 'order' | 'waitlist' | 'user' | 'shipping'
  entityId: string
  previousValue?: unknown
  newValue?: unknown
}

/**
 * 寫入管理員操作紀錄（需求 12：所有管理員操作都需要留下操作紀錄）。
 *
 * 刻意不讓寫 log 失敗連坐業務操作 —— 訂金都已經確認了，不該因為
 * 稽核表寫不進去就整筆 rollback。寫不進去會留在伺服器錯誤日誌裡。
 */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    const db = useDb()

    await db.insert(auditLogs).values({
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      previousValue: input.previousValue ?? null,
      newValue: input.newValue ?? null
    })
  } catch (error) {
    console.error('[audit] failed to write audit log', { action: input.action, entityId: input.entityId, error })
  }
}
