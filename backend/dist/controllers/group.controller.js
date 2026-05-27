"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGroups = listGroups;
exports.getGroup = getGroup;
exports.createGroup = createGroup;
exports.updateGroup = updateGroup;
exports.deleteGroup = deleteGroup;
const db_1 = require("../config/db");
const notification_service_1 = require("../services/notification.service");
const response_1 = require("../utils/response");
async function notifyMembersJoinedGroup(memberIds, groupId) {
    await Promise.all(memberIds.map((memberId) => (0, notification_service_1.notifyMemberJoinedChit)(memberId, groupId)));
}
function mapGroup(group, members = []) {
    return {
        id: group.id,
        code: `GRP-${group.id}`,
        name: group.group_name,
        monthlyAmount: Number(group.monthly_amount),
        totalMembers: group.total_members,
        durationMonths: group.duration_months,
        status: String(group.status || 'active').toUpperCase(),
        startDate: group.start_date,
        members: members.map((member) => ({ id: member.id, name: member.full_name, phone: member.mobile }))
    };
}
async function findGroup(id) {
    const [groups] = await db_1.pool.query('SELECT * FROM chit_groups WHERE id = ? LIMIT 1', [id]);
    if (!groups[0])
        return null;
    const [members] = await db_1.pool.query(`SELECT DISTINCT m.id, m.full_name, m.mobile
     FROM members m
     LEFT JOIN member_chits mc ON mc.member_id = m.id AND mc.chit_group_id = ?
     WHERE mc.id IS NOT NULL OR m.group_id = ?
     ORDER BY m.full_name`, [id, id]);
    return mapGroup(groups[0], members);
}
async function listGroups(_req, res) {
    const [groups] = await db_1.pool.query('SELECT * FROM chit_groups ORDER BY created_at DESC');
    const mapped = await Promise.all(groups.map((group) => findGroup(group.id)));
    return (0, response_1.ok)(res, mapped.filter(Boolean), 'Groups loaded');
}
async function getGroup(req, res) {
    const group = await findGroup(Number(req.params.id));
    if (!group)
        return (0, response_1.fail)(res, 404, 'Group not found');
    return (0, response_1.ok)(res, group, 'Group loaded');
}
async function createGroup(req, res) {
    const { name, monthlyAmount, totalMembers, durationMonths, startDate, status, memberIds = [] } = req.body;
    if (!name || !monthlyAmount || !totalMembers || !durationMonths || !startDate) {
        return (0, response_1.fail)(res, 400, 'Name, monthly amount, members, duration and start date are required');
    }
    const [result] = await db_1.pool.execute(`INSERT INTO chit_groups (group_name, monthly_amount, total_members, duration_months, start_date, status)
     VALUES (?, ?, ?, ?, ?, ?)`, [name, monthlyAmount, Number(totalMembers), Number(durationMonths), startDate, String(status || 'active').toLowerCase()]);
    if (Array.isArray(memberIds) && memberIds.length) {
        const ids = [...new Set(memberIds.map(Number).filter((memberId) => Number.isInteger(memberId) && memberId > 0))];
        if (ids.length) {
            await db_1.pool.query(`INSERT IGNORE INTO member_chits (member_id, chit_group_id, join_date)
         VALUES ${ids.map(() => '(?, ?, CURDATE())').join(', ')}`, ids.flatMap((memberId) => [memberId, result.insertId]));
            await db_1.pool.query(`UPDATE members SET group_id = ? WHERE group_id IS NULL AND id IN (${ids.map(() => '?').join(',')})`, [result.insertId, ...ids]);
            await notifyMembersJoinedGroup(ids, result.insertId);
        }
    }
    const group = await findGroup(result.insertId);
    return (0, response_1.created)(res, group, 'Group created');
}
async function updateGroup(req, res) {
    const id = Number(req.params.id);
    const { name, monthlyAmount, totalMembers, durationMonths, startDate, status, memberIds } = req.body;
    await db_1.pool.execute(`UPDATE chit_groups
     SET group_name = COALESCE(?, group_name),
         monthly_amount = COALESCE(?, monthly_amount),
         total_members = COALESCE(?, total_members),
         duration_months = COALESCE(?, duration_months),
         start_date = COALESCE(?, start_date),
         status = COALESCE(?, status)
     WHERE id = ?`, [
        name || null,
        monthlyAmount || null,
        totalMembers ? Number(totalMembers) : null,
        durationMonths ? Number(durationMonths) : null,
        startDate || null,
        status ? String(status).toLowerCase() : null,
        id
    ]);
    if (Array.isArray(memberIds)) {
        const ids = [...new Set(memberIds.map(Number).filter((memberId) => Number.isInteger(memberId) && memberId > 0))];
        const [existingRows] = await db_1.pool.query('SELECT member_id FROM member_chits WHERE chit_group_id = ?', [id]);
        const existingIds = existingRows.map((row) => row.member_id);
        const addedIds = ids.filter((memberId) => !existingIds.includes(memberId));
        await db_1.pool.execute('DELETE FROM member_chits WHERE chit_group_id = ?', [id]);
        await db_1.pool.execute(`UPDATE members m
       SET group_id = (
         SELECT mc.chit_group_id
         FROM member_chits mc
         WHERE mc.member_id = m.id
         ORDER BY mc.id
         LIMIT 1
       )
       WHERE m.group_id = ?`, [id]);
        if (ids.length) {
            await db_1.pool.query(`INSERT IGNORE INTO member_chits (member_id, chit_group_id, join_date)
         VALUES ${ids.map(() => '(?, ?, CURDATE())').join(', ')}`, ids.flatMap((memberId) => [memberId, id]));
            await db_1.pool.query(`UPDATE members SET group_id = ? WHERE group_id IS NULL AND id IN (${ids.map(() => '?').join(',')})`, [id, ...ids]);
            await notifyMembersJoinedGroup(addedIds, id);
        }
    }
    const group = await findGroup(id);
    if (!group)
        return (0, response_1.fail)(res, 404, 'Group not found');
    return (0, response_1.ok)(res, group, 'Group updated');
}
async function deleteGroup(req, res) {
    const id = Number(req.params.id);
    await db_1.pool.execute('DELETE FROM member_chits WHERE chit_group_id = ?', [id]);
    await db_1.pool.execute(`UPDATE members m
     SET group_id = (
       SELECT mc.chit_group_id
       FROM member_chits mc
       WHERE mc.member_id = m.id
       ORDER BY mc.id
       LIMIT 1
     )
     WHERE m.group_id = ?`, [id]);
    await db_1.pool.execute('DELETE FROM chit_groups WHERE id = ?', [id]);
    return (0, response_1.ok)(res, { id }, 'Group deleted');
}
