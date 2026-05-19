"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReports = getReports;
const db_1 = require("../config/db");
const response_1 = require("../utils/response");
function collectionMonth(value) {
    const month = Number(String(value || '').split('-')[1]);
    return month || new Date().getMonth() + 1;
}
async function count(table, where = '') {
    const [rows] = await db_1.pool.query(`SELECT COUNT(*) AS total FROM ${table} ${where}`);
    return Number(rows[0]?.total || 0);
}
async function getReports(_req, res) {
    const [members, groups, activeGroups, collectionsRows, expensesRows, auctionsRows, ledgerRows] = await Promise.all([
        count('members'),
        count('chit_groups'),
        count('chit_groups', `WHERE status = 'active'`),
        db_1.pool.query(`SELECT c.*, m.id AS member_id, m.full_name AS member_name, m.mobile AS member_mobile, m.member_code, m.status AS member_status,
              g.id AS group_id, g.group_name
       FROM collections c
       LEFT JOIN members m ON m.id = c.member_id
       LEFT JOIN chit_groups g ON g.id = c.group_id
       ORDER BY c.created_at DESC`),
        db_1.pool.query('SELECT category, amount FROM expenses'),
        db_1.pool.query('SELECT auction_month, auction_date, bid_amount, prize_amount FROM auctions ORDER BY created_at DESC'),
        db_1.pool.query('SELECT entry_type, amount FROM ledger_entries')
    ]);
    const collections = collectionsRows[0];
    const expenses = expensesRows[0];
    const auctions = auctionsRows[0];
    const ledger = ledgerRows[0];
    const totalCollected = collections.filter((item) => item.payment_status === 'paid').reduce((sum, item) => sum + Number(item.amount), 0);
    const pendingAmount = collections.filter((item) => item.payment_status !== 'paid').reduce((sum, item) => sum + Number(item.amount), 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const totalAuctionValue = auctions.reduce((sum, item) => sum + Number(item.prize_amount || item.bid_amount || 0), 0);
    const ledgerCredit = ledger.filter((item) => item.entry_type === 'credit').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const ledgerDebit = ledger.filter((item) => item.entry_type === 'debit').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const monthlyCollections = Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const monthItems = collections.filter((item) => collectionMonth(item.payment_month) === month);
        return {
            month,
            paid: monthItems.filter((item) => item.payment_status === 'paid').reduce((sum, item) => sum + Number(item.amount), 0),
            due: monthItems.reduce((sum, item) => sum + Number(item.amount), 0)
        };
    });
    const auctionTrends = auctions.slice(0, 12).reverse().map((item) => ({
        month: item.auction_month || (item.auction_date ? new Date(item.auction_date).toLocaleString('en-IN', { month: 'short' }) : 'Auction'),
        bidAmount: Number(item.bid_amount || 0),
        prizeAmount: Number(item.prize_amount || 0)
    }));
    const paymentStatus = ['paid', 'pending', 'partial'].map((status) => ({
        name: status.toUpperCase(),
        value: collections.filter((item) => item.payment_status === status).length
    }));
    const expenseByCategory = expenses.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
        return acc;
    }, {});
    const mappedCollections = collections.map((item) => ({
        id: item.id,
        month: collectionMonth(item.payment_month),
        year: item.payment_date ? new Date(item.payment_date).getFullYear() : new Date().getFullYear(),
        amount: Number(item.amount),
        paidAmount: item.payment_status === 'paid' ? Number(item.amount) : 0,
        status: String(item.payment_status || 'pending').toUpperCase(),
        member: { id: item.member_id, name: item.member_name, phone: item.member_mobile, memberCode: item.member_code, status: item.member_status },
        group: { id: item.group_id, name: item.group_name }
    }));
    return (0, response_1.ok)(res, {
        summary: {
            members,
            groups,
            totalCollected,
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
        pendingPayments: mappedCollections.filter((item) => item.status !== 'PAID').slice(0, 10),
        recentCollections: mappedCollections.slice(0, 10)
    }, 'Reports loaded');
}
