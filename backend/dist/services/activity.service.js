"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logActivity = logActivity;
exports.logRequestActivity = logRequestActivity;
const db_1 = require("../config/db");
async function logActivity(input) {
    await db_1.pool.execute(`INSERT INTO activity_logs (user_id, role, action, description, entity_type, entity_id, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        input.userId || null,
        input.role ? String(input.role).toLowerCase() : null,
        input.action,
        input.description,
        input.entityType || null,
        input.entityId || null,
        input.ipAddress || null
    ]);
}
async function logRequestActivity(req, action, description, entityType, entityId) {
    await logActivity({
        userId: req.user?.id || null,
        role: req.user?.role || null,
        action,
        description,
        entityType,
        entityId,
        ipAddress: req.ip
    });
}
