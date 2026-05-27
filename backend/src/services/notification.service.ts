import { RowDataPacket } from 'mysql2'
import { pool } from '../config/db'

type MemberNotificationTarget = RowDataPacket & {
  member_id: number
  full_name: string
  email: string | null
  mobile: string
  user_id: number | null
}

type GroupSummary = RowDataPacket & {
  group_name: string
  monthly_amount: string | number
}

async function findMemberTarget(memberId: number) {
  const [rows] = await pool.query<MemberNotificationTarget[]>(
    `SELECT m.id AS member_id, m.full_name, m.email, m.mobile, u.id AS user_id
     FROM members m
     LEFT JOIN users u ON u.mobile = m.mobile OR (m.email IS NOT NULL AND u.email = m.email)
     WHERE m.id = ?
     LIMIT 1`,
    [memberId]
  )
  return rows[0]
}

async function findGroupSummary(groupId: number) {
  const [rows] = await pool.query<GroupSummary[]>(
    'SELECT group_name, monthly_amount FROM chit_groups WHERE id = ? LIMIT 1',
    [groupId]
  )
  return rows[0]
}

async function createNotification(memberId: number, title: string, message: string) {
  const target = await findMemberTarget(memberId)
  if (!target) return

  await pool.execute(
    `INSERT INTO notifications (user_id, member_id, title, message, sent_to, notification_type, status)
     VALUES (?, ?, ?, ?, ?, 'push', 'sent')`,
    [target.user_id || null, memberId, title, message, target.email || target.mobile || target.full_name]
  )
}

export async function notifyMemberJoinedChit(memberId: number, groupId: number) {
  const group = await findGroupSummary(groupId)
  if (!group) return

  await createNotification(
    memberId,
    'Chit group joined',
    `You have joined ${group.group_name} with monthly amount ₹${Number(group.monthly_amount).toLocaleString('en-IN')}.`
  )
}

export async function notifyMemberPaymentCollected(memberId: number, groupId: number, amount: number | string, paymentDate: Date | string | null) {
  const group = await findGroupSummary(groupId)
  const dateText = paymentDate ? new Date(paymentDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')

  await createNotification(
    memberId,
    'Payment collected',
    `Payment of ₹${Number(amount).toLocaleString('en-IN')} collected${group ? ` for ${group.group_name}` : ''} on ${dateText}.`
  )
}
