import { Request, Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { logRequestActivity } from '../services/activity.service'
import { created, fail, ok } from '../utils/response'

type ExpenseRow = RowDataPacket & {
  id: number
  title: string
  category: string
  amount: string | number
  expense_date: Date | string | null
  payment_mode: string | null
  remarks: string | null
}

function mapExpense(item: ExpenseRow) {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    amount: Number(item.amount),
    expenseDate: item.expense_date,
    paymentMode: item.payment_mode,
    notes: item.remarks
  }
}

export async function listExpenses(_req: Request, res: Response) {
  const [items] = await pool.query<ExpenseRow[]>('SELECT * FROM expenses ORDER BY created_at DESC')
  return ok(res, items.map(mapExpense), 'Expenses loaded')
}

export async function createExpense(req: Request, res: Response) {
  const { title, category, amount, expenseDate, notes } = req.body
  if (!title || !amount || !expenseDate) {
    return fail(res, 400, 'Title, amount and date are required')
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO expenses (title, category, amount, expense_date, payment_mode, remarks)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, category || 'General', amount, expenseDate, String(req.body.paymentMode || 'cash').toLowerCase(), notes || null]
  )
  await pool.execute(
    `INSERT INTO ledger_entries (entry_type, title, amount, entry_date, description)
     VALUES ('debit', ?, ?, ?, ?)`,
    [`Expense: ${title}`, amount, expenseDate, notes || null]
  )
  await logRequestActivity(req, 'expense_added', `Expense ${title} added`, 'expense', result.insertId)
  const [rows] = await pool.query<ExpenseRow[]>('SELECT * FROM expenses WHERE id = ? LIMIT 1', [result.insertId])
  return created(res, mapExpense(rows[0]), 'Expense created')
}
