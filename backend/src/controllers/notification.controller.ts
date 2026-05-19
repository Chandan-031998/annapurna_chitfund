import { Request, Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { created, ok } from '../utils/response'

type NotificationRow = RowDataPacket & {
  id: number
  title: string | null
  message: string | null
  notification_type: string | null
  sent_to: string | null
  status: string | null
  created_at: Date | string
}

function mapNotification(item: NotificationRow) {
  return {
    id: item.id,
    title: item.title,
    message: item.message,
    type: item.notification_type,
    sentTo: item.sent_to,
    status: String(item.status || 'pending').toUpperCase(),
    createdAt: item.created_at
  }
}

export async function listNotifications(_req: Request, res: Response) {
  const [items] = await pool.query<NotificationRow[]>('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50')
  return ok(res, items.map(mapNotification), 'Notifications loaded')
}

export async function createPaymentReminder(req: Request, res: Response) {
  const { title = 'Payment reminder', message, sentTo, type = 'sms' } = req.body
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO notifications (title, message, sent_to, notification_type, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [title, message || 'Your chit fund monthly payment is pending. Please complete the payment.', sentTo || 'member', String(type).toLowerCase()]
  )
  const [rows] = await pool.query<NotificationRow[]>('SELECT * FROM notifications WHERE id = ? LIMIT 1', [result.insertId])
  return created(res, mapNotification(rows[0]), 'Reminder queued')
}
