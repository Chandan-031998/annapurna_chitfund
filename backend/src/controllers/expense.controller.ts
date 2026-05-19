import { Request, Response } from 'express'
import { prisma } from '../config/db'
import { created, fail, ok } from '../utils/response'

function mapExpense(item: { id: number; title: string; category: string; amount: unknown; expense_date: Date | null; payment_mode: unknown; remarks: string | null }) {
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
  const items = await prisma.expense.findMany({ orderBy: { created_at: 'desc' } })
  return ok(res, items.map(mapExpense), 'Expenses loaded')
}

export async function createExpense(req: Request, res: Response) {
  const { title, category, amount, expenseDate, notes } = req.body
  if (!title || !amount || !expenseDate) {
    return fail(res, 400, 'Title, amount and date are required')
  }

  const expense = await prisma.expense.create({
    data: { title, category: category || 'General', amount, expense_date: new Date(expenseDate), payment_mode: String(req.body.paymentMode || 'cash').toLowerCase() as any, remarks: notes }
  })
  await prisma.ledgerEntry.create({
    data: { entry_type: 'debit', title: `Expense: ${title}`, amount, entry_date: new Date(expenseDate), description: notes }
  })
  return created(res, mapExpense(expense), 'Expense created')
}
