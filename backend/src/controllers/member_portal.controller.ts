import { Request, Response } from 'express'
import { RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { fail, ok } from '../utils/response'

type PortalMemberRow = RowDataPacket & {
  id: number
  member_code: string | null
  full_name: string
  email: string | null
  mobile: string
  address: string | null
  status: string | null
  joining_date: Date | string | null
}

type PortalUserRow = RowDataPacket & {
  id: number
  full_name: string
  email: string
  mobile: string
  role: string
}

type PortalChitRow = RowDataPacket & {
  id: number
  name: string
  monthly_amount: string | number
  join_date: Date | string | null
  status: string | null
}

type PortalCollectionRow = RowDataPacket & {
  id: number
  payment_month: string | null
  payment_date: Date | string | null
  amount: string | number
  payment_status: string | null
  payment_mode: string | null
  remarks: string | null
  receipt_number: string | null
  group_id: number | null
  group_name: string | null
  monthly_amount: string | number | null
}

type PortalAuctionRow = RowDataPacket & {
  id: number
  auction_month: string | null
  auction_date: Date | string | null
  bid_amount: string | number | null
  prize_amount: string | number | null
  remarks: string | null
  group_id: number | null
  group_name: string | null
}

function mapMember(member: PortalMemberRow) {
  return {
    id: member.id,
    memberCode: member.member_code,
    name: member.full_name,
    email: member.email,
    phone: member.mobile,
    address: member.address,
    status: String(member.status || 'active').toUpperCase(),
    joinedAt: member.joining_date
  }
}

function mapUserAsMember(user: PortalUserRow) {
  return {
    id: 0,
    memberCode: null,
    name: user.full_name,
    email: user.email,
    phone: user.mobile,
    address: null,
    status: 'ACTIVE',
    joinedAt: null
  }
}

function mapChit(chit: PortalChitRow) {
  return {
    id: chit.id,
    name: chit.name,
    monthlyAmount: Number(chit.monthly_amount || 0),
    joinDate: chit.join_date,
    status: String(chit.status || 'active').toUpperCase()
  }
}

function mapCollection(collection: PortalCollectionRow) {
  return {
    id: collection.id,
    month: Number(String(collection.payment_month || '').split('-')[1]) || new Date().getMonth() + 1,
    year: Number(String(collection.payment_month || '').split('-')[0]) || new Date().getFullYear(),
    amount: Number(collection.amount || 0),
    paidAmount: collection.payment_status === 'paid' ? Number(collection.amount || 0) : 0,
    status: String(collection.payment_status || 'pending').toUpperCase(),
    paymentDate: collection.payment_date,
    paymentMode: collection.payment_mode,
    receiptNo: collection.receipt_number,
    notes: collection.remarks,
    group: collection.group_id ? { id: collection.group_id, name: collection.group_name, monthlyAmount: Number(collection.monthly_amount || 0) } : undefined
  }
}

function mapAuction(auction: PortalAuctionRow) {
  return {
    id: auction.id,
    auctionMonth: auction.auction_month,
    auctionDate: auction.auction_date,
    bidAmount: Number(auction.bid_amount || 0),
    prizeAmount: Number(auction.prize_amount || 0),
    notes: auction.remarks,
    group: auction.group_id ? { id: auction.group_id, name: auction.group_name } : undefined
  }
}

async function findLoggedInMember(req: Request) {
  const [rows] = await pool.query<PortalMemberRow[]>(
    `SELECT m.*
     FROM members m
     INNER JOIN users u ON u.id = ?
     WHERE m.mobile = u.mobile
        OR (m.email IS NOT NULL AND m.email = u.email)
        OR LOWER(m.full_name) = LOWER(u.full_name)
     LIMIT 1`,
    [req.user?.id]
  )
  return rows[0]
}

async function findLoggedInUser(req: Request) {
  const [rows] = await pool.query<PortalUserRow[]>('SELECT id, full_name, email, mobile, role FROM users WHERE id = ? LIMIT 1', [req.user?.id])
  return rows[0]
}

async function memberChits(memberId: number) {
  const [rows] = await pool.query<PortalChitRow[]>(
    `SELECT g.id, g.group_name AS name, g.monthly_amount, mc.join_date, mc.status
     FROM member_chits mc
     INNER JOIN chit_groups g ON g.id = mc.chit_group_id
     WHERE mc.member_id = ?
     ORDER BY g.group_name`,
    [memberId]
  )
  return rows.map(mapChit)
}

async function memberCollections(memberId: number, where = '') {
  const [rows] = await pool.query<PortalCollectionRow[]>(
    `SELECT c.*, r.receipt_number, g.id AS group_id, g.group_name, g.monthly_amount
     FROM collections c
     LEFT JOIN receipts r ON r.collection_id = c.id
     LEFT JOIN chit_groups g ON g.id = c.group_id
     WHERE c.member_id = ? ${where}
     ORDER BY c.created_at DESC`,
    [memberId]
  )
  return rows.map(mapCollection)
}

async function memberAuctions(memberId: number) {
  const [rows] = await pool.query<PortalAuctionRow[]>(
    `SELECT a.*, g.id AS group_id, g.group_name
     FROM auctions a
     INNER JOIN member_chits mc ON mc.chit_group_id = a.group_id AND mc.member_id = ?
     LEFT JOIN chit_groups g ON g.id = a.group_id
     ORDER BY a.auction_date DESC, a.created_at DESC`,
    [memberId]
  )
  return rows.map(mapAuction)
}

function nextPaymentDate(chits: unknown[]) {
  if (!chits.length) return null
  const date = new Date()
  if (date.getDate() > 10) {
    date.setMonth(date.getMonth() + 1)
  }
  date.setDate(10)
  return date.toISOString().slice(0, 10)
}

async function getPortalContext(req: Request, res: Response) {
  const user = await findLoggedInUser(req)
  if (!user) {
    fail(res, 404, 'User account not found')
    return null
  }

  const member = await findLoggedInMember(req)
  return { user, member }
}

export async function getMemberDashboard(req: Request, res: Response) {
  const context = await getPortalContext(req, res)
  if (!context) return
  const { user, member } = context

  if (!member) {
    return ok(res, {
      member: mapUserAsMember(user),
      summary: { chits: 0, paidAmount: 0, duesAmount: 0, receipts: 0, nextPaymentDate: null, auctionStatus: 'No active auction' },
      chits: [],
      recentPayments: [],
      dues: [],
      receipts: [],
      auctionStatus: []
    }, 'Member dashboard loaded')
  }

  const [chits, payments, dues, receipts, auctions] = await Promise.all([
    memberChits(member.id),
    memberCollections(member.id, `AND c.payment_status = 'paid'`),
    memberCollections(member.id, `AND c.payment_status <> 'paid'`),
    memberCollections(member.id, `AND r.receipt_number IS NOT NULL`),
    memberAuctions(member.id)
  ])

  return ok(res, {
    member: mapMember(member),
    summary: {
      chits: chits.length,
      paidAmount: payments.reduce((sum, payment) => sum + payment.paidAmount, 0),
      duesAmount: dues.reduce((sum, due) => sum + due.amount, 0),
      receipts: receipts.length,
      nextPaymentDate: nextPaymentDate(chits),
      auctionStatus: auctions[0] ? `${auctions[0].group?.name || 'Chit'} - ${auctions[0].prizeAmount ? 'Completed' : 'Scheduled'}` : 'No active auction'
    },
    chits,
    recentPayments: payments.slice(0, 5),
    dues,
    receipts: receipts.slice(0, 5),
    auctionStatus: auctions.slice(0, 5)
  }, 'Member dashboard loaded')
}

export async function getMemberChits(req: Request, res: Response) {
  const context = await getPortalContext(req, res)
  if (!context) return
  const { member } = context
  if (!member) return ok(res, [], 'Member chits loaded')
  return ok(res, await memberChits(member.id), 'Member chits loaded')
}

export async function getMemberPayments(req: Request, res: Response) {
  const context = await getPortalContext(req, res)
  if (!context) return
  const { member } = context
  if (!member) return ok(res, [], 'Member payments loaded')
  return ok(res, await memberCollections(member.id, `AND c.payment_status = 'paid'`), 'Member payments loaded')
}

export async function getMemberDues(req: Request, res: Response) {
  const context = await getPortalContext(req, res)
  if (!context) return
  const { member } = context
  if (!member) return ok(res, [], 'Member dues loaded')
  return ok(res, await memberCollections(member.id, `AND c.payment_status <> 'paid'`), 'Member dues loaded')
}

export async function getMemberReceipts(req: Request, res: Response) {
  const context = await getPortalContext(req, res)
  if (!context) return
  const { member } = context
  if (!member) return ok(res, [], 'Member receipts loaded')
  return ok(res, await memberCollections(member.id, `AND r.receipt_number IS NOT NULL`), 'Member receipts loaded')
}

export async function getMemberAuctionStatus(req: Request, res: Response) {
  const context = await getPortalContext(req, res)
  if (!context) return
  const { member } = context
  if (!member) return ok(res, [], 'Member auction status loaded')
  return ok(res, await memberAuctions(member.id), 'Member auction status loaded')
}
