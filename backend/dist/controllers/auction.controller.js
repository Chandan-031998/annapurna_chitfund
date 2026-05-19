"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuctions = listAuctions;
exports.createAuction = createAuction;
const db_1 = require("../config/db");
const response_1 = require("../utils/response");
function mapAuction(item) {
    return {
        id: item.id,
        winnerMemberId: item.winner_member_id,
        winnerName: item.members?.full_name || 'Unassigned',
        winningAmount: Number(item.prize_amount || item.bid_amount || 0),
        discount: Math.max(Number(item.bid_amount || 0) - Number(item.prize_amount || 0), 0),
        auctionDate: item.auction_date,
        notes: item.remarks,
        group: item.chit_groups ? { id: item.chit_groups.id, name: item.chit_groups.group_name } : undefined
    };
}
async function listAuctions(_req, res) {
    const items = await db_1.prisma.auction.findMany({
        include: { chit_groups: true, members: true },
        orderBy: { created_at: 'desc' }
    });
    return (0, response_1.ok)(res, items.map(mapAuction), 'Auctions loaded');
}
async function createAuction(req, res) {
    const { groupId, auctionDate, winnerName, winnerMemberId, winningAmount, bidAmount, prizeAmount, discount = 0, notes } = req.body;
    const finalPrize = Number(prizeAmount || winningAmount || 0);
    const finalBid = Number(bidAmount || finalPrize + Number(discount || 0));
    if (!groupId || !auctionDate || (!winnerName && !winnerMemberId) || !finalPrize) {
        return (0, response_1.fail)(res, 400, 'Group, auction date, winner and winning amount are required');
    }
    const auction = await db_1.prisma.auction.create({
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
    });
    return (0, response_1.created)(res, { ...mapAuction(auction), winnerName }, 'Auction created');
}
