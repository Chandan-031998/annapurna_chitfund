import { Request, Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { created, fail, ok } from '../utils/response'

type AuctionRow = RowDataPacket & {
  id: number
  winner_member_id: number | null
  winner_name: string | null
  bid_amount: string | number | null
  prize_amount: string | number | null
  auction_date: Date | string | null
  remarks: string | null
  group_id: number | null
  group_name: string | null
}

function mapAuction(item: AuctionRow) {
  return {
    id: item.id,
    winnerMemberId: item.winner_member_id,
    winnerName: item.winner_name || 'Unassigned',
    winningAmount: Number(item.prize_amount || item.bid_amount || 0),
    discount: Math.max(Number(item.bid_amount || 0) - Number(item.prize_amount || 0), 0),
    auctionDate: item.auction_date,
    notes: item.remarks,
    group: item.group_id ? { id: item.group_id, name: item.group_name } : undefined
  }
}

async function auctionRows(where = '', params: unknown[] = []) {
  const [rows] = await pool.query<AuctionRow[]>(
    `SELECT a.*, m.full_name AS winner_name, g.id AS group_id, g.group_name
     FROM auctions a
     LEFT JOIN members m ON m.id = a.winner_member_id
     LEFT JOIN chit_groups g ON g.id = a.group_id
     ${where}
     ORDER BY a.created_at DESC`,
    params
  )
  return rows
}

export async function listAuctions(_req: Request, res: Response) {
  const items = await auctionRows()
  return ok(res, items.map(mapAuction), 'Auctions loaded')
}

export async function createAuction(req: Request, res: Response) {
  const { groupId, auctionDate, winnerName, winnerMemberId, winningAmount, bidAmount, prizeAmount, discount = 0, notes } = req.body
  const finalPrize = Number(prizeAmount || winningAmount || 0)
  const finalBid = Number(bidAmount || finalPrize + Number(discount || 0))
  if (!groupId || !auctionDate || (!winnerName && !winnerMemberId) || !finalPrize) {
    return fail(res, 400, 'Group, auction date, winner and winning amount are required')
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO auctions (group_id, auction_date, auction_month, winner_member_id, bid_amount, prize_amount, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      Number(groupId),
      auctionDate,
      new Date(auctionDate).toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      winnerMemberId ? Number(winnerMemberId) : null,
      finalBid,
      finalPrize,
      `${winnerName || ''}${notes ? ` - ${notes}` : ''}`
    ]
  )
  const [rows] = await auctionRows('WHERE a.id = ?', [result.insertId])
  return created(res, { ...mapAuction(rows[0]), winnerName: winnerName || rows[0]?.winner_name }, 'Auction created')
}
