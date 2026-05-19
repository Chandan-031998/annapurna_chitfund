"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCollections = listCollections;
exports.createCollection = createCollection;
const db_1 = require("../config/db");
const response_1 = require("../utils/response");
function mapCollection(item) {
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
    };
}
async function listCollections(_req, res) {
    const items = await db_1.prisma.collection.findMany({
        include: { members: true, chit_groups: true, receipts: true },
        orderBy: { created_at: 'desc' }
    });
    return (0, response_1.ok)(res, items.map(mapCollection), 'Collections loaded');
}
async function createCollection(req, res) {
    const { memberId, groupId, month, year, amount, paidAmount = 0, receiptNo, notes, paymentMode = 'cash' } = req.body;
    if (!memberId || !groupId || !month || !year || !amount) {
        return (0, response_1.fail)(res, 400, 'Member, group, month, year and amount are required');
    }
    const status = Number(paidAmount) >= Number(amount) ? 'paid' : Number(paidAmount) > 0 ? 'partial' : 'pending';
    const collection = await db_1.prisma.collection.create({
        data: {
            member_id: Number(memberId),
            group_id: Number(groupId),
            amount,
            payment_month: `${year}-${String(month).padStart(2, '0')}`,
            payment_date: Number(paidAmount) > 0 ? new Date() : undefined,
            payment_mode: String(paymentMode).toLowerCase(),
            payment_status: status,
            remarks: notes
        },
        include: { members: true, chit_groups: true, receipts: true }
    });
    if (receiptNo) {
        await db_1.prisma.receipts.create({ data: { receipt_number: receiptNo, collection_id: collection.id } });
    }
    const refreshed = await db_1.prisma.collection.findUniqueOrThrow({
        where: { id: collection.id },
        include: { members: true, chit_groups: true, receipts: true }
    });
    await db_1.prisma.ledgerEntry.create({
        data: {
            entry_type: 'credit',
            title: `Collection ${receiptNo || refreshed.payment_month}`,
            amount: paidAmount || amount,
            entry_date: new Date(),
            description: `Collection from ${refreshed.members.full_name}`
        }
    });
    return (0, response_1.created)(res, mapCollection(refreshed), 'Collection recorded');
}
