import { Request, Response } from 'express'
import { prisma } from '../config/db'
import { created, ok } from '../utils/response'

function mapNotification(item: { id: number; title: string | null; message: string | null; notification_type: unknown; sent_to: string | null; status: unknown; created_at: Date }) {
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
  const items = await prisma.notifications.findMany({ orderBy: { created_at: 'desc' }, take: 50 })
  return ok(res, items.map(mapNotification), 'Notifications loaded')
}

export async function createPaymentReminder(req: Request, res: Response) {
  const { title = 'Payment reminder', message, sentTo, type = 'sms' } = req.body
  const notification = await prisma.notifications.create({
    data: {
      title,
      message: message || 'Your chit fund monthly payment is pending. Please complete the payment.',
      sent_to: sentTo || 'member',
      notification_type: String(type).toLowerCase() as any,
      status: 'pending'
    }
  })
  return created(res, mapNotification(notification), 'Reminder queued')
}
