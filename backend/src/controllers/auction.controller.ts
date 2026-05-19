import { Request, Response } from 'express'
import { prisma } from '../config/db'
import { created, fail, ok } from '../utils/response'

function mapAuction(item: any) {
  return {
    id: item.id,
    winnerMemberId: item.winner_member_id,
    winnerName: item.members?.full_name || 'Unassigned',
    winningAmount: Number(item.prize_amount || item.bid_amount || 0),
    discount: Math.max(Number(item.bid_amount || 0) - Number(item.prize_amount || 0), 0),
    auctionDate: item.auction_date,
    notes: item.remarks,
    group: item.chit_groups ? { id: item.chit_groups.id, name: item.chit_groups.group_name } : undefined
  }
}

export async function listAuctions(_req: Request, res: Response) {
  const items = await prisma.auction.findMany({
    include: { chit_groups: true, members: true },
    orderBy: { created_at: 'desc' }
  })
  return ok(res, items.map(mapAuction), 'Auctions loaded')
}

export async function createAuction(req: Request, res: Response) {
  const { groupId, auctionDate, winnerName, winnerMemberId, winningAmount, bidAmount, prizeAmount, discount = 0, notes } = req.body
  const finalPrize = Number(prizeAmount || winningAmount || 0)
  const finalBid = Number(bidAmount || finalPrize + Number(discount || 0))
  if (!groupId || !auctionDate || (!winnerName && !winnerMemberId) || !finalPrize) {
    return fail(res, 400, 'Group, auction date, winner and winning amount are required')
  }

  const auction = await prisma.auction.create({
    data: {
      group_id: Number(groupId),
      auction_date: new Date(auctionDate),
      auction_month: new Date(auctionDate).toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
      winner_member_id: winnerMemberId ? Number(winnerMemberId) : undefined,
      bid_amount: finalBid,
      prize_amount: finalPrize,
      remarks: `${winnerName}${notes ? ` - ${notes}` : ''}`
    },
    include: { chit_groups: true, members: true }
  })
  return created(res, { ...mapAuction(auction), winnerName }, 'Auction created')
}
