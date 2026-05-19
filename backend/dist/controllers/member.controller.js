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
async function getMember(req, res) {
    const member = await db_1.prisma.member.findUnique({ where: { id: Number(req.params.id) } });
    if (!member)
        return (0, response_1.fail)(res, 404, 'Member not found');
    return (0, response_1.ok)(res, mapMember(member), 'Member loaded');
}
async function listMembers(req, res) {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100);
    const search = String(req.query.search || '');
    const where = search
        ? {
            OR: [
                { full_name: { contains: search } },
                { mobile: { contains: search } },
                { member_code: { contains: search } },
                { email: { contains: search } }
            ]
        }
        : {};
    const [items, total] = await Promise.all([
        db_1.prisma.member.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { created_at: 'desc' }
        }),
        db_1.prisma.member.count({ where })
    ]);
    return (0, response_1.ok)(res, { items: items.map(mapMember), total, page, limit }, 'Members loaded');
}
async function createMember(req, res) {
    const { memberCode, name, email, phone, address, status, aadhaarNumber, photo, groupId } = req.body;
    if (!memberCode || !name || !phone) {
        return (0, response_1.fail)(res, 400, 'Member code, name and phone are required');
    }
    const member = await db_1.prisma.member.create({
        data: {
            member_code: memberCode,
            full_name: name,
            email,
            mobile: phone,
            address,
            aadhaar_number: aadhaarNumber,
            photo,
            group_id: groupId ? Number(groupId) : undefined,
            status: String(status || 'active').toLowerCase()
        }
    });
    return (0, response_1.created)(res, mapMember(member), 'Member created');
}
async function updateMember(req, res) {
    const id = Number(req.params.id);
    const { memberCode, name, email, phone, address, status, aadhaarNumber, photo, groupId } = req.body;
    const member = await db_1.prisma.member.update({
        where: { id },
        data: {
            member_code: memberCode,
            full_name: name,
            email,
            mobile: phone,
            address,
            aadhaar_number: aadhaarNumber,
            photo,
            group_id: groupId ? Number(groupId) : null,
            status: status ? String(status).toLowerCase() : undefined
        }
    });
    return (0, response_1.ok)(res, mapMember(member), 'Member updated');
}
async function deleteMember(req, res) {
    await db_1.prisma.member.delete({ where: { id: Number(req.params.id) } });
    return (0, response_1.ok)(res, { id: Number(req.params.id) }, 'Member deleted');
}
