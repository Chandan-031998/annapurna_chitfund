"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCollections = listCollections;
exports.createCollection = createCollection;
const db_1 = require("../config/db");
const response_1 = require("../utils/response");
function collectionMonth(value) {
    const month = Number(String(value || '').split('-')[1]);
    return month || new Date().getMonth() + 1;
}
function mapCollection(item) {
    return {
        id: item.id,
        month: collectionMonth(item.payment_month),
        year: item.payment_date ? new Date(item.payment_date).getFullYear() : new Date().getFullYear(),
        amount: Number(item.amount),
        paidAmount: item.payment_status === 'paid' ? Number(item.amount) : 0,
        status: String(item.payment_status || 'pending').toUpperCase(),
        paymentMode: item.payment_mode,
        receiptNo: item.receipt_number,
        notes: item.remarks,
        member: item.member_id ? { id: item.member_id, name: item.member_name, phone: item.member_mobile, memberCode: item.member_code, status: item.member_status } : undefined,
        group: item.group_id ? { id: item.group_id, name: item.group_name, monthlyAmount: Number(item.monthly_amount || 0) } : undefined
    };
}
async function collectionQuery(where = '', params = []) {
    const [rows] = await db_1.pool.query(`SELECT c.*, r.receipt_number,
            m.id AS member_id, m.full_name AS member_name, m.mobile AS member_mobile, m.member_code, m.status AS member_status,
            g.id AS group_id, g.group_name, g.monthly_amount
     FROM collections c
     LEFT JOIN receipts r ON r.collection_id = c.id
     LEFT JOIN members m ON m.id = c.member_id
     LEFT JOIN chit_groups g ON g.id = c.group_id
     ${where}
     ORDER BY c.created_at DESC`, params);
    return rows;
}
async function listCollections(_req, res) {
    const items = await collectionQuery();
    return (0, response_1.ok)(res, items.map(mapCollection), 'Collections loaded');
}
async function createCollection(req, res) {
    const { memberId, groupId, month, year, amount, paidAmount = 0, receiptNo, notes, paymentMode = 'cash' } = req.body;
    if (!memberId || !groupId || !month || !year || !amount) {
        return (0, response_1.fail)(res, 400, 'Member, group, month, year and amount are required');
    }
    const status = Number(paidAmount) >= Number(amount) ? 'paid' : Number(paidAmount) > 0 ? 'partial' : 'pending';
    const [result] = await db_1.pool.execute(`INSERT INTO collections (member_id, group_id, amount, payment_month, payment_date, payment_mode, payment_status, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
        Number(memberId),
        Number(groupId),
        amount,
        `${year}-${String(month).padStart(2, '0')}`,
        Number(paidAmount) > 0 ? new Date() : null,
        String(paymentMode).toLowerCase(),
        status,
        notes || null
    ]);
    if (receiptNo) {
        await db_1.pool.execute('INSERT INTO receipts (receipt_number, collection_id) VALUES (?, ?)', [receiptNo, result.insertId]);
    }
    const [memberRows] = await db_1.pool.query('SELECT full_name FROM members WHERE id = ? LIMIT 1', [memberId]);
    await db_1.pool.execute(`INSERT INTO ledger_entries (entry_type, title, amount, entry_date, description)
     VALUES ('credit', ?, ?, CURDATE(), ?)`, [`Collection ${receiptNo || `${year}-${month}`}`, paidAmount || amount, `Collection from ${memberRows[0]?.full_name || 'member'}`]);
    const [rows] = await collectionQuery('WHERE c.id = ?', [result.insertId]);
    return (0, response_1.created)(res, mapCollection(rows[0]), 'Collection recorded');
}
