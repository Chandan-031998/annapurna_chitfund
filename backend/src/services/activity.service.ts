import { Request } from 'express'
import { pool } from '../config/db'

type ActivityInput = {
  userId?: number | null
  role?: string | null
  action: string
  description: string
  entityType?: string | null
  entityId?: number | null
  ipAddress?: string | null
}

export async function logActivity(input: ActivityInput) {
  await pool.execute(
    `INSERT INTO activity_logs (user_id, role, action, description, entity_type, entity_id, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.userId || null,
      input.role ? String(input.role).toLowerCase() : null,
      input.action,
      input.description,
      input.entityType || null,
      input.entityId || null,
      input.ipAddress || null
    ]
  )
}

export async function logRequestActivity(req: Request, action: string, description: string, entityType?: string, entityId?: number) {
  await logActivity({
    userId: req.user?.id || null,
    role: req.user?.role || null,
    action,
    description,
    entityType,
    entityId,
    ipAddress: req.ip
  })
}
