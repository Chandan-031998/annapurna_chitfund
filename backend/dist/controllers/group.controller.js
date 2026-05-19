"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGroups = listGroups;
exports.getGroup = getGroup;
exports.createGroup = createGroup;
exports.updateGroup = updateGroup;
exports.deleteGroup = deleteGroup;
const db_1 = require("../config/db");
const response_1 = require("../utils/response");
function mapGroup(group) {
    return {
        id: group.id,
        code: `GRP-${group.id}`,
        name: group.group_name,
        monthlyAmount: Number(group.monthly_amount),
        totalMembers: group.total_members,
        durationMonths: group.duration_months,
        status: String(group.status || 'active').toUpperCase(),
        startDate: group.start_date,
        members: group.members?.map((member) => ({ id: member.id, name: member.full_name, phone: member.mobile })) || []
    };
}
async function listGroups(_req, res) {
    const items = await db_1.prisma.chitGroup.findMany({ include: { members: true }, orderBy: { created_at: 'desc' } });
    return (0, response_1.ok)(res, items.map(mapGroup), 'Groups loaded');
}
async function getGroup(req, res) {
    const group = await db_1.prisma.chitGroup.findUnique({ where: { id: Number(req.params.id) }, include: { members: true } });
    if (!group)
        return (0, response_1.fail)(res, 404, 'Group not found');
    return (0, response_1.ok)(res, mapGroup(group), 'Group loaded');
}
async function createGroup(req, res) {
    const { name, monthlyAmount, totalMembers, durationMonths, startDate, status, memberIds = [] } = req.body;
    if (!name || !monthlyAmount || !totalMembers || !durationMonths || !startDate) {
        return (0, response_1.fail)(res, 400, 'Name, monthly amount, members, duration and start date are required');
    }
    const group = await db_1.prisma.chitGroup.create({
        data: {
            group_name: name,
            monthly_amount: monthlyAmount,
            total_members: Number(totalMembers),
            duration_months: Number(durationMonths),
            start_date: new Date(startDate),
            status: status ? String(status).toLowerCase() : 'active'
        },
        include: { members: true }
    });
    if (Array.isArray(memberIds) && memberIds.length) {
        await db_1.prisma.member.updateMany({ where: { id: { in: memberIds.map(Number) } }, data: { group_id: group.id } });
    }
    return (0, response_1.created)(res, mapGroup(group), 'Group created');
}
async function updateGroup(req, res) {
    const { name, monthlyAmount, totalMembers, durationMonths, startDate, status, memberIds } = req.body;
    const data = {
        group_name: name,
        monthly_amount: monthlyAmount,
        total_members: totalMembers ? Number(totalMembers) : undefined,
        duration_months: durationMonths ? Number(durationMonths) : undefined,
        start_date: startDate ? new Date(startDate) : undefined,
        status: status ? String(status).toLowerCase() : undefined
    };
    const group = await db_1.prisma.chitGroup.update({ where: { id: Number(req.params.id) }, data, include: { members: true } });
    if (Array.isArray(memberIds)) {
        await db_1.prisma.member.updateMany({ where: { group_id: group.id }, data: { group_id: null } });
        if (memberIds.length) {
            await db_1.prisma.member.updateMany({ where: { id: { in: memberIds.map(Number) } }, data: { group_id: group.id } });
        }
    }
    const refreshed = await db_1.prisma.chitGroup.findUniqueOrThrow({ where: { id: group.id }, include: { members: true } });
    return (0, response_1.ok)(res, mapGroup(refreshed), 'Group updated');
}
async function deleteGroup(req, res) {
    await db_1.prisma.chitGroup.delete({ where: { id: Number(req.params.id) } });
    return (0, response_1.ok)(res, { id: Number(req.params.id) }, 'Group deleted');
}
