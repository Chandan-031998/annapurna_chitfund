import { Request, Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { created, fail, ok } from '../utils/response'

type MemberRow = RowDataPacket & {
  id: number
  member_code: string | null
  full_name: string
  email: string | null
  mobile: string
  address: string | null
  aadhaar_number: string | null
  photo: string | null
  group_id: number | null
  status: string | null
  joining_date: Date | string | null
  created_at: Date | string
}

function mapMember(member: MemberRow) {
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

async function findMember(id: number) {
  const [rows] = await pool.query<MemberRow[]>('SELECT * FROM members WHERE id = ? LIMIT 1', [id])
  return rows[0]
}

export async function getMember(req: Request, res: Response) {
  const member = await findMember(Number(req.params.id))
  if (!member) return fail(res, 404, 'Member not found')
  return ok(res, mapMember(member), 'Member loaded')
}

export async function listMembers(req: Request, res: Response) {
  const page = Math.max(Number(req.query.page || 1), 1)
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 100)
  const search = String(req.query.search || '').trim()
  const offset = (page - 1) * limit

  const params: unknown[] = []
  let where = ''
  if (search) {
    where = 'WHERE full_name LIKE ? OR mobile LIKE ? OR member_code LIKE ? OR email LIKE ?'
    const pattern = `%${search}%`
    params.push(pattern, pattern, pattern, pattern)
  }

  const [items] = await pool.query<MemberRow[]>(
    `SELECT * FROM members ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )
  const [countRows] = await pool.query<(RowDataPacket & { total: number })[]>(
    `SELECT COUNT(*) AS total FROM members ${where}`,
    params
  )

  return ok(res, { items: items.map(mapMember), total: Number(countRows[0]?.total || 0), page, limit }, 'Members loaded')
}

export async function createMember(req: Request, res: Response) {
  const { memberCode, name, email, phone, address, status, aadhaarNumber, photo, groupId } = req.body
  if (!memberCode || !name || !phone) {
    return fail(res, 400, 'Member code, name and phone are required')
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO members (member_code, full_name, email, mobile, address, aadhaar_number, photo, group_id, status, joining_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
    [
      memberCode,
      name,
      email || null,
      phone,
      address || null,
      aadhaarNumber || null,
      photo || null,
      groupId ? Number(groupId) : null,
      String(status || 'active').toLowerCase()
    ]
  )
  const member = await findMember(result.insertId)
  return created(res, mapMember(member), 'Member created')
}

export async function updateMember(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { memberCode, name, email, phone, address, status, aadhaarNumber, photo, groupId } = req.body

  await pool.execute(
    `UPDATE members
     SET member_code = ?, full_name = ?, email = ?, mobile = ?, address = ?, aadhaar_number = ?, photo = ?, group_id = ?, status = ?
     WHERE id = ?`,
    [
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
    ]
  )
  const member = await findMember(id)
  if (!member) return fail(res, 404, 'Member not found')
  return ok(res, mapMember(member), 'Member updated')
}

export async function deleteMember(req: Request, res: Response) {
  const id = Number(req.params.id)
  await pool.execute('DELETE FROM members WHERE id = ?', [id])
  return ok(res, { id }, 'Member deleted')
}
