import { Request, Response } from 'express'
import { ledger_entries_entry_type } from '@prisma/client'
import { prisma } from '../config/db'
import { created, fail, ok } from '../utils/response'

function mapLedger(item: { id: number; entry_type: ledger_entries_entry_type; title: string | null; amount: unknown; entry_date: Date | null; description: string | null }) {
  return {
    id: item.id,
    type: item.entry_type.toUpperCase(),
    title: item.title || '',
    amount: Number(item.amount || 0),
    entryDate: item.entry_date,
    notes: item.description
  }
}

export async function listLedger(_req: Request, res: Response) {
  const items = await prisma.ledgerEntry.findMany({ orderBy: { created_at: 'desc' } })
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

  const entry = await prisma.ledgerEntry.create({
    data: {
      entry_type: String(type).toLowerCase() as ledger_entries_entry_type,
      title,
      amount,
      entry_date: new Date(entryDate),
      description: notes
    }
  })
  return created(res, mapLedger(entry), 'Ledger entry created')
}
