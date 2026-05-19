import { Request, Response } from 'express'
import { Prisma, members_status } from '@prisma/client'
import { prisma } from '../config/db'
import { created, fail, ok } from '../utils/response'

function mapMember(member: Prisma.MemberGetPayload<Record<string, never>>) {
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
  }
}

export async function getMember(req: Request, res: Response) {
  const member = await prisma.member.findUnique({ where: { id: Number(req.params.id) } })
  if (!member) return fail(res, 404, 'Member not found')
  return ok(res, mapMember(member), 'Member loaded')
}

export async function listMembers(req: Request, res: Response) {
  const page = Math.max(Number(req.query.page || 1), 1)
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100)
  const search = String(req.query.search || '')
  const where: Prisma.MemberWhereInput = search
    ? {
        OR: [
          { full_name: { contains: search } },
          { mobile: { contains: search } },
          { member_code: { contains: search } },
          { email: { contains: search } }
        ]
      }
    : {}

  const [items, total] = await Promise.all([
    prisma.member.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { created_at: 'desc' }
    }),
    prisma.member.count({ where })
  ])
  return ok(res, { items: items.map(mapMember), total, page, limit }, 'Members loaded')
}

export async function createMember(req: Request, res: Response) {
  const { memberCode, name, email, phone, address, status, aadhaarNumber, photo, groupId } = req.body
  if (!memberCode || !name || !phone) {
    return fail(res, 400, 'Member code, name and phone are required')
  }

  const member = await prisma.member.create({
    data: {
      member_code: memberCode,
      full_name: name,
      email,
      mobile: phone,
      address,
      aadhaar_number: aadhaarNumber,
      photo,
      group_id: groupId ? Number(groupId) : undefined,
      status: String(status || 'active').toLowerCase() as members_status
    }
  })
  return created(res, mapMember(member), 'Member created')
}

export async function updateMember(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { memberCode, name, email, phone, address, status, aadhaarNumber, photo, groupId } = req.body
  const member = await prisma.member.update({
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
      status: status ? String(status).toLowerCase() as members_status : undefined
    }
  })
  return ok(res, mapMember(member), 'Member updated')
}

export async function deleteMember(req: Request, res: Response) {
  await prisma.member.delete({ where: { id: Number(req.params.id) } })
  return ok(res, { id: Number(req.params.id) }, 'Member deleted')
}
