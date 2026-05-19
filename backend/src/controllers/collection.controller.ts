import { Request, Response } from 'express'
import { collections_payment_mode, collections_payment_status } from '@prisma/client'
import { prisma } from '../config/db'
import { created, fail, ok } from '../utils/response'

function mapCollection(item: any) {
  return {
    id: item.id,
    month: Number(String(item.payment_month || '1').replace(/\D/g, '')) || new Date().getMonth() + 1,
    year: item.payment_date ? new Date(item.payment_date).getFullYear() : new Date().getFullYear(),
    amount: Number(item.amount),
    paidAmount: item.payment_status === 'paid' ? Number(item.amount) : 0,
    status: String(item.payment_status || 'pending').toUpperCase(),
    paymentMode: item.payment_mode,
    receiptNo: item.receipts?.[0]?.receipt_number,
    notes: item.remarks,
    member: item.members ? { id: item.members.id, name: item.members.full_name, phone: item.members.mobile, memberCode: item.members.member_code, status: item.members.status } : undefined,
    group: item.chit_groups ? { id: item.chit_groups.id, name: item.chit_groups.group_name, monthlyAmount: Number(item.chit_groups.monthly_amount) } : undefined
  }
}

export async function listCollections(_req: Request, res: Response) {
  const items = await prisma.collection.findMany({
    include: { members: true, chit_groups: true, receipts: true },
    orderBy: { created_at: 'desc' }
  })
  return ok(res, items.map(mapCollection), 'Collections loaded')
}

export async function createCollection(req: Request, res: Response) {
  const { memberId, groupId, month, year, amount, paidAmount = 0, receiptNo, notes, paymentMode = 'cash' } = req.body
  if (!memberId || !groupId || !month || !year || !amount) {
    return fail(res, 400, 'Member, group, month, year and amount are required')
  }

  const status: collections_payment_status = Number(paidAmount) >= Number(amount) ? 'paid' : Number(paidAmount) > 0 ? 'partial' : 'pending'
  const collection = await prisma.collection.create({
    data: {
      member_id: Number(memberId),
      group_id: Number(groupId),
      amount,
      payment_month: `${year}-${String(month).padStart(2, '0')}`,
      payment_date: Number(paidAmount) > 0 ? new Date() : undefined,
      payment_mode: String(paymentMode).toLowerCase() as collections_payment_mode,
      payment_status: status,
      remarks: notes
    },
    include: { members: true, chit_groups: true, receipts: true }
  })

  if (receiptNo) {
    await prisma.receipts.create({ data: { receipt_number: receiptNo, collection_id: collection.id } })
  }
  const refreshed = await prisma.collection.findUniqueOrThrow({
    where: { id: collection.id },
    include: { members: true, chit_groups: true, receipts: true }
  })
  await prisma.ledgerEntry.create({
    data: {
      entry_type: 'credit',
      title: `Collection ${receiptNo || refreshed.payment_month}`,
      amount: paidAmount || amount,
      entry_date: new Date(),
      description: `Collection from ${refreshed.members.full_name}`
    }
  })
  return created(res, mapCollection(refreshed), 'Collection recorded')
}
