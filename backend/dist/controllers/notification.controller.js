"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNotifications = listNotifications;
exports.createPaymentReminder = createPaymentReminder;
const db_1 = require("../config/db");
const response_1 = require("../utils/response");
function mapNotification(item) {
    return {
        id: item.id,
        title: item.title,
        message: item.message,
        type: item.notification_type,
        sentTo: item.sent_to,
        status: String(item.status || 'pending').toUpperCase(),
        createdAt: item.created_at
    };
}
async function listNotifications(_req, res) {
    const [items] = await db_1.pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
    return (0, response_1.ok)(res, items.map(mapNotification), 'Notifications loaded');
}
async function createPaymentReminder(req, res) {
    const { title = 'Payment reminder', message, sentTo, type = 'sms' } = req.body;
    const [result] = await db_1.pool.execute(`INSERT INTO notifications (title, message, sent_to, notification_type, status)
     VALUES (?, ?, ?, ?, 'pending')`, [title, message || 'Your chit fund monthly payment is pending. Please complete the payment.', sentTo || 'member', String(type).toLowerCase()]);
    const [rows] = await db_1.pool.query('SELECT * FROM notifications WHERE id = ? LIMIT 1', [result.insertId]);
    return (0, response_1.created)(res, mapNotification(rows[0]), 'Reminder queued');
}
