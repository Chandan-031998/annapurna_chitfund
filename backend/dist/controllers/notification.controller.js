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
    const items = await db_1.prisma.notifications.findMany({ orderBy: { created_at: 'desc' }, take: 50 });
    return (0, response_1.ok)(res, items.map(mapNotification), 'Notifications loaded');
}
async function createPaymentReminder(req, res) {
    const { title = 'Payment reminder', message, sentTo, type = 'sms' } = req.body;
    const notification = await db_1.prisma.notifications.create({
        data: {
            title,
            message: message || 'Your chit fund monthly payment is pending. Please complete the payment.',
            sent_to: sentTo || 'member',
            notification_type: String(type).toLowerCase(),
            status: 'pending'
        }
    });
    return (0, response_1.created)(res, mapNotification(notification), 'Reminder queued');
}
