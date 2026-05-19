import { Request, Response } from 'express'
import { prisma } from '../config/db'
import { Prisma, chit_groups_status } from '@prisma/client'
import { created, fail, ok } from '../utils/response'

function mapGroup(group: { id: number; group_name: string; monthly_amount: unknown; total_members: number; duration_months: number; status: unknown; start_date: Date; members?: { id: number; full_name: string; mobile: string }[] }) {
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
  }
}

export async function listGroups(_req: Request, res: Response) {
  const items = await prisma.chitGroup.findMany({ include: { members: true }, orderBy: { created_at: 'desc' } })
  return ok(res, items.map(mapGroup), 'Groups loaded')
}

export async function getGroup(req: Request, res: Response) {
  const group = await prisma.chitGroup.findUnique({ where: { id: Number(req.params.id) }, include: { members: true } })
  if (!group) return fail(res, 404, 'Group not found')
  return ok(res, mapGroup(group), 'Group loaded')
}

export async function createGroup(req: Request, res: Response) {
  const { name, monthlyAmount, totalMembers, durationMonths, startDate, status, memberIds = [] } = req.body
  if (!name || !monthlyAmount || !totalMembers || !durationMonths || !startDate) {
    return fail(res, 400, 'Name, monthly amount, members, duration and start date are required')
  }

  const group = await prisma.chitGroup.create({
    data: {
      group_name: name,
      monthly_amount: monthlyAmount,
      total_members: Number(totalMembers),
      duration_months: Number(durationMonths),
      start_date: new Date(startDate),
      status: status ? String(status).toLowerCase() as chit_groups_status : 'active'
    },
    include: { members: true }
  })
  if (Array.isArray(memberIds) && memberIds.length) {
    await prisma.member.updateMany({ where: { id: { in: memberIds.map(Number) } }, data: { group_id: group.id } })
  }
  return created(res, mapGroup(group), 'Group created')
}

export async function updateGroup(req: Request, res: Response) {
  const { name, monthlyAmount, totalMembers, durationMonths, startDate, status, memberIds } = req.body
  const data: Prisma.ChitGroupUpdateInput = {
    group_name: name,
    monthly_amount: monthlyAmount,
    total_members: totalMembers ? Number(totalMembers) : undefined,
    duration_months: durationMonths ? Number(durationMonths) : undefined,
    start_date: startDate ? new Date(startDate) : undefined,
    status: status ? String(status).toLowerCase() as chit_groups_status : undefined
  }
  const group = await prisma.chitGroup.update({ where: { id: Number(req.params.id) }, data, include: { members: true } })
  if (Array.isArray(memberIds)) {
    await prisma.member.updateMany({ where: { group_id: group.id }, data: { group_id: null } })
    if (memberIds.length) {
      await prisma.member.updateMany({ where: { id: { in: memberIds.map(Number) } }, data: { group_id: group.id } })
    }
  }
  const refreshed = await prisma.chitGroup.findUniqueOrThrow({ where: { id: group.id }, include: { members: true } })
  return ok(res, mapGroup(refreshed), 'Group updated')
}

export async function deleteGroup(req: Request, res: Response) {
  await prisma.chitGroup.delete({ where: { id: Number(req.params.id) } })
  return ok(res, { id: Number(req.params.id) }, 'Group deleted')
}
