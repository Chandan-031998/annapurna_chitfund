import { Request, Response } from 'express'
import { RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { logRequestActivity } from '../services/activity.service'
import { ok } from '../utils/response'

type CollectionReportRow = RowDataPacket & {
  id: number
  payment_month: string | null
  payment_date: Date | string | null
  amount: string | number
  payment_status: string | null
  member_id: number | null
  member_name: string | null
  member_mobile: string | null
  member_code: string | null
  member_status: string | null
  group_id: number | null
  group_name: string | null
}

type AuctionReportRow = RowDataPacket & {
  id: number
  group_id: number | null
  group_name: string | null
  auction_month: string | null
  auction_date: Date | string | null
  bid_amount: string | number | null
  prize_amount: string | number | null
}

type ExpenseReportRow = RowDataPacket & {
  category: string
  amount: string | number
}

type LedgerReportRow = RowDataPacket & {
  entry_type: string
  amount: string | number | null
}

type ActivityLogRow = RowDataPacket & {
  id: number
  action: string
  description: string | null
  role: string | null
  created_at: Date | string
}

function collectionMonth(value: string | null) {
  const month = Number(String(value || '').split('-')[1])
  return month || new Date().getMonth() + 1
}

async function count(table: string, where = '') {
  const [rows] = await pool.query<(RowDataPacket & { total: number })[]>(`SELECT COUNT(*) AS total FROM ${table} ${where}`)
  return Number(rows[0]?.total || 0)
}

export async function getReports(_req: Request, res: Response) {
  const [members, groups, activeGroups, collectionsRows, expensesRows, auctionsRows, ledgerRows, activityRows] = await Promise.all([
    count('members'),
    count('chit_groups'),
    count('chit_groups', `WHERE status = 'active'`),
    pool.query<CollectionReportRow[]>(
      `SELECT c.*, m.id AS member_id, m.full_name AS member_name, m.mobile AS member_mobile, m.member_code, m.status AS member_status,
              g.id AS group_id, g.group_name
       FROM collections c
       LEFT JOIN members m ON m.id = c.member_id
       LEFT JOIN chit_groups g ON g.id = c.group_id
       ORDER BY c.created_at DESC`
    ),
    pool.query<ExpenseReportRow[]>('SELECT category, amount FROM expenses'),
    pool.query<AuctionReportRow[]>(
      `SELECT a.id, a.group_id, g.group_name, a.auction_month, a.auction_date, a.bid_amount, a.prize_amount
       FROM auctions a
       LEFT JOIN chit_groups g ON g.id = a.group_id
       ORDER BY a.created_at DESC`
    ),
    pool.query<LedgerReportRow[]>('SELECT entry_type, amount FROM ledger_entries'),
    pool.query<ActivityLogRow[]>('SELECT id, action, description, role, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 10')
  ])

  const collections = collectionsRows[0]
  const expenses = expensesRows[0]
  const auctions = auctionsRows[0]
  const ledger = ledgerRows[0]
  const activity = activityRows[0]

  const totalCollected = collections.filter((item) => item.payment_status === 'paid').reduce((sum, item) => sum + Number(item.amount), 0)
  const pendingAmount = collections.filter((item) => item.payment_status !== 'paid').reduce((sum, item) => sum + Number(item.amount), 0)
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0)
  const totalAuctionValue = auctions.reduce((sum, item) => sum + Number(item.prize_amount || item.bid_amount || 0), 0)
  const ledgerCredit = ledger.filter((item) => item.entry_type === 'credit').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const ledgerDebit = ledger.filter((item) => item.entry_type === 'debit').reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const monthlyCollections = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const monthItems = collections.filter((item) => collectionMonth(item.payment_month) === month)
    return {
      month,
      paid: monthItems.filter((item) => item.payment_status === 'paid').reduce((sum, item) => sum + Number(item.amount), 0),
      due: monthItems.filter((item) => item.payment_status !== 'paid').reduce((sum, item) => sum + Number(item.amount), 0)
    }
  })

  const auctionTrends = auctions.slice(0, 12).reverse().map((item) => ({
    month: item.auction_month || (item.auction_date ? new Date(item.auction_date).toLocaleString('en-IN', { month: 'short' }) : 'Auction'),
    bidAmount: Number(item.bid_amount || 0),
    prizeAmount: Number(item.prize_amount || 0)
  }))

  const paymentStatus = ['paid', 'pending', 'partial'].map((status) => ({
    name: status.toUpperCase(),
    value: collections.filter((item) => item.payment_status === status).length
  }))

  const expenseByCategory = expenses.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + Number(item.amount)
    return acc
  }, {})

  const mappedCollections = collections.map((item) => ({
    id: item.id,
    month: collectionMonth(item.payment_month),
    year: item.payment_date ? new Date(item.payment_date).getFullYear() : new Date().getFullYear(),
    amount: Number(item.amount),
    paidAmount: item.payment_status === 'paid' ? Number(item.amount) : 0,
    status: String(item.payment_status || 'pending').toUpperCase(),
    member: { id: item.member_id, name: item.member_name, phone: item.member_mobile, memberCode: item.member_code, status: item.member_status },
    group: { id: item.group_id, name: item.group_name }
  }))
  const dueRecords = mappedCollections.filter((item) => item.status !== 'PAID')
  const currentMonth = new Date().getMonth() + 1
  const monthlyCollected = monthlyCollections.find((item) => item.month === currentMonth)?.paid || 0
  const upcomingAuction = auctions
    .filter((item) => item.auction_date && new Date(item.auction_date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.auction_date || 0).getTime() - new Date(b.auction_date || 0).getTime())[0]

  const sumBy = (items: typeof dueRecords, keyFor: (item: typeof dueRecords[number]) => string) => {
    const totals = items.reduce<Record<string, { name: string; amount: number; count: number }>>((acc, item) => {
      const name = keyFor(item) || 'Unassigned'
      acc[name] = acc[name] || { name, amount: 0, count: 0 }
      acc[name].amount += Number(item.amount || 0)
      acc[name].count += 1
      return acc
    }, {})
    return Object.values(totals)
  }

  return ok(res, {
    summary: {
      members,
      groups,
      totalCollected,
      monthlyCollected,
      pendingAmount,
      totalExpenses,
      totalAuctionValue,
      activeGroups,
      ledgerBalance: ledgerCredit - ledgerDebit,
      profit: totalCollected + ledgerCredit - totalExpenses - ledgerDebit
    },
    monthlyCollections,
    auctionTrends,
    paymentStatus,
    expenseByCategory: Object.entries(expenseByCategory).map(([category, amount]) => ({ category, amount })),
    pendingPayments: dueRecords.slice(0, 10),
    recentCollections: mappedCollections.slice(0, 10),
    dueTracking: {
      records: dueRecords,
      monthWise: sumBy(dueRecords, (item) => `${item.year}-${String(item.month).padStart(2, '0')}`),
      memberWise: sumBy(dueRecords, (item) => item.member?.name || 'Unknown member'),
      chitWise: sumBy(dueRecords, (item) => item.group?.name || 'Unknown chit')
    },
    upcomingAuction: upcomingAuction ? {
      id: upcomingAuction.id,
      groupId: upcomingAuction.group_id,
      groupName: upcomingAuction.group_name,
      auctionMonth: upcomingAuction.auction_month,
      auctionDate: upcomingAuction.auction_date,
      bidAmount: Number(upcomingAuction.bid_amount || 0),
      prizeAmount: Number(upcomingAuction.prize_amount || 0)
    } : null,
    recentActivity: activity.map((item) => ({
      id: item.id,
      action: item.action,
      description: item.description,
      role: item.role,
      createdAt: item.created_at
    }))
  }, 'Reports loaded')
}

export async function logReportExport(req: Request, res: Response) {
  const reportType = String(req.body.reportType || 'report')
  const format = String(req.body.format || 'file').toUpperCase()
  await logRequestActivity(req, 'report_exported', `${reportType} exported as ${format}`, 'report')
  return ok(res, { reportType, format }, 'Report export logged')
}
