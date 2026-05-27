"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyMemberJoinedChit = notifyMemberJoinedChit;
exports.notifyMemberPaymentCollected = notifyMemberPaymentCollected;
const db_1 = require("../config/db");
async function findMemberTarget(memberId) {
    const [rows] = await db_1.pool.query(`SELECT m.id AS member_id, m.full_name, m.email, m.mobile, u.id AS user_id
     FROM members m
     LEFT JOIN users u ON u.mobile = m.mobile OR (m.email IS NOT NULL AND u.email = m.email)
     WHERE m.id = ?
     LIMIT 1`, [memberId]);
    return rows[0];
}
async function findGroupSummary(groupId) {
    const [rows] = await db_1.pool.query('SELECT group_name, monthly_amount FROM chit_groups WHERE id = ? LIMIT 1', [groupId]);
    return rows[0];
}
async function createNotification(memberId, title, message) {
    const target = await findMemberTarget(memberId);
    if (!target)
        return;
    await db_1.pool.execute(`INSERT INTO notifications (user_id, member_id, title, message, sent_to, notification_type, status)
     VALUES (?, ?, ?, ?, ?, 'push', 'sent')`, [target.user_id || null, memberId, title, message, target.email || target.mobile || target.full_name]);
}
async function notifyMemberJoinedChit(memberId, groupId) {
    const group = await findGroupSummary(groupId);
    if (!group)
        return;
    await createNotification(memberId, 'Chit group joined', `You have joined ${group.group_name} with monthly amount ₹${Number(group.monthly_amount).toLocaleString('en-IN')}.`);
}
async function notifyMemberPaymentCollected(memberId, groupId, amount, paymentDate) {
    const group = await findGroupSummary(groupId);
    const dateText = paymentDate ? new Date(paymentDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
    await createNotification(memberId, 'Payment collected', `Payment of ₹${Number(amount).toLocaleString('en-IN')} collected${group ? ` for ${group.group_name}` : ''} on ${dateText}.`);
}
