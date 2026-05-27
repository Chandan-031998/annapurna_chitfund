import { Request, Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { created, ok } from '../utils/response'

type NotificationRow = RowDataPacket & {
  id: number
  user_id: number | null
  member_id: number | null
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
    userId: item.user_id,
    memberId: item.member_id,
    title: item.title,
    message: item.message,
    type: item.notification_type,
    sentTo: item.sent_to,
    status: String(item.status || 'pending').toUpperCase(),
    createdAt: item.created_at
  }
}

export async function listNotifications(req: Request, res: Response) {
  const isMember = req.user?.role === 'MEMBER'
  const [items] = isMember
    ? await pool.query<NotificationRow[]>(
      `SELECT *
       FROM notifications
       WHERE user_id = ? OR sent_to = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user?.id, req.user?.email]
    )
    : await pool.query<NotificationRow[]>('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50')
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
