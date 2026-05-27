"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuctions = listAuctions;
exports.createAuction = createAuction;
const db_1 = require("../config/db");
const activity_service_1 = require("../services/activity.service");
const response_1 = require("../utils/response");
function mapAuction(item) {
    return {
        id: item.id,
        winnerMemberId: item.winner_member_id,
        winnerName: item.winner_name || 'Unassigned',
        winningAmount: Number(item.prize_amount || item.bid_amount || 0),
        discount: Math.max(Number(item.bid_amount || 0) - Number(item.prize_amount || 0), 0),
        auctionDate: item.auction_date,
        notes: item.remarks,
        group: item.group_id ? { id: item.group_id, name: item.group_name } : undefined
    };
}
async function auctionRows(where = '', params = []) {
    const [rows] = await db_1.pool.query(`SELECT a.*, m.full_name AS winner_name, g.id AS group_id, g.group_name
     FROM auctions a
     LEFT JOIN members m ON m.id = a.winner_member_id
     LEFT JOIN chit_groups g ON g.id = a.group_id
     ${where}
     ORDER BY a.created_at DESC`, params);
    return rows;
}
async function listAuctions(_req, res) {
    const items = await auctionRows();
    return (0, response_1.ok)(res, items.map(mapAuction), 'Auctions loaded');
}
async function createAuction(req, res) {
    const { groupId, auctionDate, winnerName, winnerMemberId, winningAmount, bidAmount, prizeAmount, discount = 0, notes } = req.body;
    const finalPrize = Number(prizeAmount || winningAmount || 0);
    const finalBid = Number(bidAmount || finalPrize + Number(discount || 0));
    if (!groupId || !auctionDate || (!winnerName && !winnerMemberId) || !finalPrize) {
        return (0, response_1.fail)(res, 400, 'Group, auction date, winner and winning amount are required');
    }
    const [result] = await db_1.pool.execute(`INSERT INTO auctions (group_id, auction_date, auction_month, winner_member_id, bid_amount, prize_amount, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        Number(groupId),
        auctionDate,
        new Date(auctionDate).toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        winnerMemberId ? Number(winnerMemberId) : null,
        finalBid,
        finalPrize,
        `${winnerName || ''}${notes ? ` - ${notes}` : ''}`
    ]);
    await (0, activity_service_1.logRequestActivity)(req, 'auction_created', `Auction created for group ${groupId}`, 'auction', result.insertId);
    const [rows] = await auctionRows('WHERE a.id = ?', [result.insertId]);
    return (0, response_1.created)(res, { ...mapAuction(rows[0]), winnerName: winnerName || rows[0]?.winner_name }, 'Auction created');
}
