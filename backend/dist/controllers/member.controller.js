"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMember = getMember;
exports.listMembers = listMembers;
exports.createMember = createMember;
exports.updateMember = updateMember;
exports.deleteMember = deleteMember;
const db_1 = require("../config/db");
const response_1 = require("../utils/response");
function mapMember(member) {
    return {
        id: member.id,
        memberCode: member.member_code,
        name: member.full_name,
        email: member.email,
        phone: member.mobile,
        address: member.address,
        aadhaarNumber: member.aadhaar_number,
        photo: member.photo,
        groupId: member.group_id,
        status: String(member.status || 'active').toUpperCase(),
        joinedAt: member.joining_date,
        createdAt: member.created_at
    };
}
async function findMember(id) {
    const [rows] = await db_1.pool.query('SELECT * FROM members WHERE id = ? LIMIT 1', [id]);
    return rows[0];
}
async function getMember(req, res) {
    const member = await findMember(Number(req.params.id));
    if (!member)
        return (0, response_1.fail)(res, 404, 'Member not found');
    return (0, response_1.ok)(res, mapMember(member), 'Member loaded');
}
async function listMembers(req, res) {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const search = String(req.query.search || '').trim();
    const offset = (page - 1) * limit;
    const params = [];
    let where = '';
    if (search) {
        where = 'WHERE full_name LIKE ? OR mobile LIKE ? OR member_code LIKE ? OR email LIKE ?';
        const pattern = `%${search}%`;
        params.push(pattern, pattern, pattern, pattern);
    }
    const [items] = await db_1.pool.query(`SELECT * FROM members ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [countRows] = await db_1.pool.query(`SELECT COUNT(*) AS total FROM members ${where}`, params);
    return (0, response_1.ok)(res, { items: items.map(mapMember), total: Number(countRows[0]?.total || 0), page, limit }, 'Members loaded');
}
async function createMember(req, res) {
    const { memberCode, name, email, phone, address, status, aadhaarNumber, photo, groupId } = req.body;
    if (!memberCode || !name || !phone) {
        return (0, response_1.fail)(res, 400, 'Member code, name and phone are required');
    }
    const [result] = await db_1.pool.execute(`INSERT INTO members (member_code, full_name, email, mobile, address, aadhaar_number, photo, group_id, status, joining_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`, [
        memberCode,
        name,
        email || null,
        phone,
        address || null,
        aadhaarNumber || null,
        photo || null,
        groupId ? Number(groupId) : null,
        String(status || 'active').toLowerCase()
    ]);
    const member = await findMember(result.insertId);
    return (0, response_1.created)(res, mapMember(member), 'Member created');
}
async function updateMember(req, res) {
    const id = Number(req.params.id);
    const { memberCode, name, email, phone, address, status, aadhaarNumber, photo, groupId } = req.body;
    await db_1.pool.execute(`UPDATE members
     SET member_code = ?, full_name = ?, email = ?, mobile = ?, address = ?, aadhaar_number = ?, photo = ?, group_id = ?, status = ?
     WHERE id = ?`, [
        memberCode,
        name,
        email || null,
        phone,
        address || null,
        aadhaarNumber || null,
        photo || null,
        groupId ? Number(groupId) : null,
        status ? String(status).toLowerCase() : 'active',
        id
    ]);
    const member = await findMember(id);
    if (!member)
        return (0, response_1.fail)(res, 404, 'Member not found');
    return (0, response_1.ok)(res, mapMember(member), 'Member updated');
}
async function deleteMember(req, res) {
    const id = Number(req.params.id);
    await db_1.pool.execute('DELETE FROM members WHERE id = ?', [id]);
    return (0, response_1.ok)(res, { id }, 'Member deleted');
}
