import { Request, Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { logRequestActivity } from '../services/activity.service'
import { notifyMemberPaymentCollected } from '../services/notification.service'
import { created, fail, ok } from '../utils/response'

type CollectionRow = RowDataPacket & {
  id: number
  payment_month: string | null
  payment_date: Date | string | null
  amount: string | number
  payment_status: string | null
  payment_mode: string | null
  remarks: string | null
  receipt_number: string | null
  member_id: number | null
  member_name: string | null
  member_mobile: string | null
  member_code: string | null
  member_status: string | null
  group_id: number | null
  group_name: string | null
  monthly_amount: string | number | null
}

function collectionMonth(value: string | null) {
  const month = Number(String(value || '').split('-')[1])
  return month || new Date().getMonth() + 1
}

function collectionYear(value: string | null, fallback: Date | string | null) {
  const year = Number(String(value || '').split('-')[0])
  return year || (fallback ? new Date(fallback).getFullYear() : new Date().getFullYear())
}

function mapCollection(item: CollectionRow) {
  return {
    id: item.id,
    month: collectionMonth(item.payment_month),
    year: collectionYear(item.payment_month, item.payment_date),
    amount: Number(item.amount),
    paidAmount: item.payment_status === 'paid' ? Number(item.amount) : 0,
    status: String(item.payment_status || 'pending').toUpperCase(),
    paymentDate: item.payment_date,
    paymentMode: item.payment_mode,
    receiptNo: item.receipt_number,
    notes: item.remarks,
    member: item.member_id ? { id: item.member_id, name: item.member_name, phone: item.member_mobile, memberCode: item.member_code, status: item.member_status } : undefined,
    group: item.group_id ? { id: item.group_id, name: item.group_name, monthlyAmount: Number(item.monthly_amount || 0) } : undefined
  }
}

async function collectionQuery(where = '', params: unknown[] = []) {
  const [rows] = await pool.query<CollectionRow[]>(
    `SELECT c.*, r.receipt_number,
            m.id AS member_id, m.full_name AS member_name, m.mobile AS member_mobile, m.member_code, m.status AS member_status,
            g.id AS group_id, g.group_name, g.monthly_amount
     FROM collections c
     LEFT JOIN receipts r ON r.collection_id = c.id
     LEFT JOIN members m ON m.id = c.member_id
     LEFT JOIN chit_groups g ON g.id = c.group_id
     ${where}
     ORDER BY c.created_at DESC`,
    params
  )
  return rows
}

export async function listCollections(_req: Request, res: Response) {
  const items = await collectionQuery()
  return ok(res, items.map(mapCollection), 'Collections loaded')
}

export async function createCollection(req: Request, res: Response) {
  const { memberId, groupId, month, year, amount, paidAmount = 0, receiptNo, notes, paymentMode = 'cash' } = req.body
  if (!memberId || !groupId || !month || !year || !amount) {
    return fail(res, 400, 'Member, group, month, year and amount are required')
  }

  const status = Number(paidAmount) >= Number(amount) ? 'paid' : Number(paidAmount) > 0 ? 'partial' : 'pending'
  const paymentDate = Number(paidAmount) > 0 ? new Date() : null
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO collections (member_id, group_id, amount, payment_month, payment_date, payment_mode, payment_status, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(memberId),
      Number(groupId),
      amount,
      `${year}-${String(month).padStart(2, '0')}`,
      paymentDate,
      String(paymentMode).toLowerCase(),
      status,
      notes || null
    ]
  )

  if (receiptNo) {
    await pool.execute('INSERT INTO receipts (receipt_number, collection_id) VALUES (?, ?)', [receiptNo, result.insertId])
  }

  const [memberRows] = await pool.query<(RowDataPacket & { full_name: string })[]>('SELECT full_name FROM members WHERE id = ? LIMIT 1', [memberId])
  await pool.execute(
    `INSERT INTO ledger_entries (entry_type, title, amount, entry_date, description)
     VALUES ('credit', ?, ?, CURDATE(), ?)`,
    [`Collection ${receiptNo || `${year}-${month}`}`, paidAmount || amount, `Collection from ${memberRows[0]?.full_name || 'member'}`]
  )

  if (paymentDate) {
    await notifyMemberPaymentCollected(Number(memberId), Number(groupId), paidAmount || amount, paymentDate)
  }
  await logRequestActivity(req, 'payment_collected', `Payment ${receiptNo || `${year}-${month}`} recorded`, 'collection', result.insertId)

  const [rows] = await collectionQuery('WHERE c.id = ?', [result.insertId])
  return created(res, mapCollection(rows[0]), 'Collection recorded')
}

export async function updateCollection(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { memberId, groupId, month, year, amount, paidAmount = 0, receiptNo, notes, paymentMode = 'cash' } = req.body
  if (!memberId || !groupId || !month || !year || !amount) {
    return fail(res, 400, 'Member, group, month, year and amount are required')
  }

  const [existingRows] = await collectionQuery('WHERE c.id = ?', [id])
  if (!existingRows[0]) return fail(res, 404, 'Collection not found')

  const status = Number(paidAmount) >= Number(amount) ? 'paid' : Number(paidAmount) > 0 ? 'partial' : 'pending'
  const paymentDate = Number(paidAmount) > 0 ? existingRows[0].payment_date || new Date() : null

  await pool.execute(
    `UPDATE collections
     SET member_id = ?, group_id = ?, amount = ?, payment_month = ?, payment_date = ?, payment_mode = ?, payment_status = ?, remarks = ?
     WHERE id = ?`,
    [
      Number(memberId),
      Number(groupId),
      amount,
      `${year}-${String(month).padStart(2, '0')}`,
      paymentDate,
      String(paymentMode).toLowerCase(),
      status,
      notes || null,
      id
    ]
  )

  await pool.execute('DELETE FROM receipts WHERE collection_id = ?', [id])
  if (receiptNo) {
    await pool.execute('INSERT INTO receipts (receipt_number, collection_id) VALUES (?, ?)', [receiptNo, id])
  }
  await logRequestActivity(req, 'payment_updated', `Payment ${receiptNo || `${year}-${month}`} updated`, 'collection', id)

  const [rows] = await collectionQuery('WHERE c.id = ?', [id])
  return ok(res, mapCollection(rows[0]), 'Collection updated')
}

export async function deleteCollection(req: Request, res: Response) {
  const id = Number(req.params.id)
  const [existingRows] = await collectionQuery('WHERE c.id = ?', [id])
  if (!existingRows[0]) return fail(res, 404, 'Collection not found')

  await pool.execute('DELETE FROM collections WHERE id = ?', [id])
  await logRequestActivity(req, 'payment_deleted', `Payment ${existingRows[0].receipt_number || id} deleted`, 'collection', id)
  return ok(res, { id }, 'Collection deleted')
}
