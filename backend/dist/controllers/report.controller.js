"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getReports = getReports;
const db_1 = require("../config/db");
const response_1 = require("../utils/response");
function collectionMonth(value) {
    const month = Number(String(value || '').split('-')[1]);
    return month || new Date().getMonth() + 1;
}
async function getReports(_req, res) {
    const [members, groups, collections, expenses, auctions, ledger] = await Promise.all([
        db_1.prisma.member.count(),
        db_1.prisma.chitGroup.count(),
        db_1.prisma.collection.findMany({ include: { members: true, chit_groups: true, receipts: true } }),
        db_1.prisma.expense.findMany(),
        db_1.prisma.auction.findMany({ include: { chit_groups: true, members: true } }),
        db_1.prisma.ledgerEntry.findMany()
    ]);
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
        member: { id: item.members.id, name: item.members.full_name, phone: item.members.mobile, memberCode: item.members.member_code, status: item.members.status },
        group: { id: item.chit_groups.id, name: item.chit_groups.group_name }
    }));
    return (0, response_1.ok)(res, {
        summary: {
            members,
            groups,
            totalCollected,
            pendingAmount,
            totalExpenses,
            totalAuctionValue,
            activeGroups: await db_1.prisma.chitGroup.count({ where: { status: 'active' } }),
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
