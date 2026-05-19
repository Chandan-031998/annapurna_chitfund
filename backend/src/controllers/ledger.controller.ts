import { Request, Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { created, fail, ok } from '../utils/response'

type LedgerRow = RowDataPacket & {
  id: number
  entry_type: string
  title: string | null
  amount: string | number | null
  entry_date: Date | string | null
  description: string | null
  created_at: Date | string
}

function mapLedger(item: LedgerRow) {
  return {
    id: item.id,
    type: String(item.entry_type).toUpperCase(),
    title: item.title || '',
    amount: Number(item.amount || 0),
    entryDate: item.entry_date,
    notes: item.description
  }
}

export async function listLedger(_req: Request, res: Response) {
  const [items] = await pool.query<LedgerRow[]>('SELECT * FROM ledger_entries ORDER BY created_at DESC')
  let runningBalance = 0
  const chronological = [...items].reverse().map((item) => {
    const mapped = mapLedger(item)
    runningBalance += mapped.type === 'CREDIT' ? mapped.amount : -mapped.amount
    return { ...mapped, runningBalance }
  }).reverse()
  return ok(res, chronological, 'Ledger loaded')
}

export async function createLedgerEntry(req: Request, res: Response) {
  const { type, title, amount, entryDate, notes } = req.body
  if (!type || !title || !amount || !entryDate) {
    return fail(res, 400, 'Type, title, amount and date are required')
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO ledger_entries (entry_type, title, amount, entry_date, description)
     VALUES (?, ?, ?, ?, ?)`,
    [String(type).toLowerCase(), title, amount, entryDate, notes || null]
  )
  const [rows] = await pool.query<LedgerRow[]>('SELECT * FROM ledger_entries WHERE id = ? LIMIT 1', [result.insertId])
  return created(res, mapLedger(rows[0]), 'Ledger entry created')
}
