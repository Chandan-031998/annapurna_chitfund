import { Request, Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { PoolConnection } from 'mysql2/promise'
import { pool } from '../config/db'
import { logRequestActivity } from '../services/activity.service'
import { notifyMemberJoinedChit } from '../services/notification.service'
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

type MemberChitRow = RowDataPacket & {
  id: number
  name: string
  monthly_amount: string | number
  join_date: Date | string | null
  status: string | null
}

function mapChit(chit: MemberChitRow) {
  return {
    id: chit.id,
    name: chit.name,
    monthlyAmount: Number(chit.monthly_amount),
    joinDate: chit.join_date,
    status: String(chit.status || 'active').toUpperCase()
  }
}

function mapMember(member: MemberRow, chits: MemberChitRow[] = []) {
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
    chits: chits.map(mapChit),
    chitGroupIds: chits.map((chit) => chit.id),
    chitsJoined: chits.map((chit) => `${chit.name} ${Number(chit.monthly_amount) ? `₹${Number(chit.monthly_amount)}` : ''}`.trim()).join(', '),
    status: String(member.status || 'active').toUpperCase(),
    joinedAt: member.joining_date,
    createdAt: member.created_at
  }
}

async function findMember(id: number) {
  const [rows] = await pool.query<MemberRow[]>('SELECT * FROM members WHERE id = ? LIMIT 1', [id])
  return rows[0]
}

async function findMemberChits(memberId: number) {
  const [rows] = await pool.query<MemberChitRow[]>(
    `SELECT g.id, g.group_name AS name, g.monthly_amount, mc.join_date, mc.status
     FROM member_chits mc
     INNER JOIN chit_groups g ON g.id = mc.chit_group_id
     WHERE mc.member_id = ?
     ORDER BY g.group_name`,
    [memberId]
  )
  return rows
}

function normalizeChitGroupIds(body: Record<string, unknown>) {
  const rawIds = body.chit_group_ids ?? body.chitGroupIds
  const ids = Array.isArray(rawIds) ? rawIds : body.groupId ? [body.groupId] : []
  return [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))]
}

async function syncMemberChits(connection: PoolConnection, memberId: number, chitGroupIds: number[]) {
  await connection.execute('DELETE FROM member_chits WHERE member_id = ?', [memberId])
  if (chitGroupIds.length) {
    await connection.query(
      `INSERT INTO member_chits (member_id, chit_group_id, join_date)
       VALUES ${chitGroupIds.map(() => '(?, ?, CURDATE())').join(', ')}`,
      chitGroupIds.flatMap((groupId) => [memberId, groupId])
    )
  }
  await connection.execute('UPDATE members SET group_id = ? WHERE id = ?', [chitGroupIds[0] || null, memberId])
}

async function findMemberChitIds(memberId: number) {
  const [rows] = await pool.query<(RowDataPacket & { chit_group_id: number })[]>('SELECT chit_group_id FROM member_chits WHERE member_id = ?', [memberId])
  return rows.map((row) => row.chit_group_id)
}

async function notifyNewChits(memberId: number, chitGroupIds: number[]) {
  await Promise.all(chitGroupIds.map((groupId) => notifyMemberJoinedChit(memberId, groupId)))
}

export async function getMember(req: Request, res: Response) {
  const member = await findMember(Number(req.params.id))
  if (!member) return fail(res, 404, 'Member not found')
  const chits = await findMemberChits(member.id)
  return ok(res, mapMember(member, chits), 'Member loaded')
}

export async function getMemberChits(req: Request, res: Response) {
  const member = await findMember(Number(req.params.id))
  if (!member) return fail(res, 404, 'Member not found')
  return ok(res, (await findMemberChits(member.id)).map(mapChit), 'Member chits loaded')
}

export async function addMemberChits(req: Request, res: Response) {
  const memberId = Number(req.params.id)
  const member = await findMember(memberId)
  if (!member) return fail(res, 404, 'Member not found')

  const chitGroupIds = normalizeChitGroupIds(req.body)
  if (!chitGroupIds.length) return fail(res, 400, 'At least one chit group is required')
  const existingChitIds = await findMemberChitIds(memberId)
  const addedChitIds = chitGroupIds.filter((groupId) => !existingChitIds.includes(groupId))

  await pool.query(
    `INSERT IGNORE INTO member_chits (member_id, chit_group_id, join_date)
     VALUES ${chitGroupIds.map(() => '(?, ?, CURDATE())').join(', ')}`,
    chitGroupIds.flatMap((groupId) => [memberId, groupId])
  )

  if (!member.group_id) {
    await pool.execute('UPDATE members SET group_id = ? WHERE id = ?', [chitGroupIds[0], memberId])
  }

  await notifyNewChits(memberId, addedChitIds)
  return ok(res, (await findMemberChits(memberId)).map(mapChit), 'Member chits updated')
}

export async function deleteMemberChit(req: Request, res: Response) {
  const memberId = Number(req.params.id)
  const chitGroupId = Number(req.params.chitGroupId)
  const member = await findMember(memberId)
  if (!member) return fail(res, 404, 'Member not found')

  await pool.execute('DELETE FROM member_chits WHERE member_id = ? AND chit_group_id = ?', [memberId, chitGroupId])

  if (member.group_id === chitGroupId) {
    const [remaining] = await pool.query<(RowDataPacket & { chit_group_id: number })[]>(
      'SELECT chit_group_id FROM member_chits WHERE member_id = ? ORDER BY id LIMIT 1',
      [memberId]
    )
    await pool.execute('UPDATE members SET group_id = ? WHERE id = ?', [remaining[0]?.chit_group_id || null, memberId])
  }

  return ok(res, { memberId, chitGroupId }, 'Member chit removed')
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

  const memberIds = items.map((member) => member.id)
  let chitsByMember = new Map<number, MemberChitRow[]>()
  if (memberIds.length) {
    const [chits] = await pool.query<(MemberChitRow & { member_id: number })[]>(
      `SELECT mc.member_id, g.id, g.group_name AS name, g.monthly_amount, mc.join_date, mc.status
       FROM member_chits mc
       INNER JOIN chit_groups g ON g.id = mc.chit_group_id
       WHERE mc.member_id IN (${memberIds.map(() => '?').join(', ')})
       ORDER BY g.group_name`,
      memberIds
    )
    chitsByMember = chits.reduce((map, chit) => {
      map.set(chit.member_id, [...(map.get(chit.member_id) || []), chit])
      return map
    }, new Map<number, MemberChitRow[]>())
  }

  return ok(res, { items: items.map((member) => mapMember(member, chitsByMember.get(member.id) || [])), total: Number(countRows[0]?.total || 0), page, limit }, 'Members loaded')
}

export async function createMember(req: Request, res: Response) {
  const { memberCode, name, full_name, email, phone, mobile, address, status, aadhaarNumber, aadhaar_number, photo } = req.body
  const fullName = name || full_name
  const mobileNumber = phone || mobile
  const normalizedMemberCode = memberCode || `MEM-${Date.now().toString().slice(-6)}`
  const chitGroupIds = normalizeChitGroupIds(req.body)

  if (!fullName || !mobileNumber) {
    return fail(res, 400, 'Name and phone are required')
  }

  const [existing] = await pool.query<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM members WHERE mobile = ? OR (? IS NOT NULL AND email = ?) LIMIT 1',
    [mobileNumber, email || null, email || null]
  )
  if (existing[0]) return fail(res, 409, 'Member already exists. Edit the existing member to add chit groups.')

  const connection = await pool.getConnection()
  let insertedId = 0
  try {
    await connection.beginTransaction()
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO members (member_code, full_name, email, mobile, address, aadhaar_number, photo, group_id, status, joining_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
      [
        normalizedMemberCode,
        fullName,
        email || null,
        mobileNumber,
        address || null,
        aadhaarNumber || aadhaar_number || null,
        photo || null,
        chitGroupIds[0] || null,
        String(status || 'active').toLowerCase()
      ]
    )
    insertedId = result.insertId
    await syncMemberChits(connection, insertedId, chitGroupIds)
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  await notifyNewChits(insertedId, chitGroupIds)
  await logRequestActivity(req, 'member_added', `Member ${fullName} was added`, 'member', insertedId)
  const member = await findMember(insertedId)
  const chits = await findMemberChits(insertedId)
  return created(res, mapMember(member, chits), 'Member created')
}

export async function updateMember(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { memberCode, name, email, phone, address, status, aadhaarNumber, photo } = req.body
  const hasChitGroupIds = Array.isArray(req.body.chit_group_ids) || Array.isArray(req.body.chitGroupIds) || 'groupId' in req.body
  const chitGroupIds = normalizeChitGroupIds(req.body)
  const currentMember = await findMember(id)
  if (!currentMember) return fail(res, 404, 'Member not found')
  const existingChitIds = hasChitGroupIds ? await findMemberChitIds(id) : []
  const addedChitIds = chitGroupIds.filter((groupId) => !existingChitIds.includes(groupId))

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    await connection.execute(
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
        hasChitGroupIds ? chitGroupIds[0] || null : currentMember.group_id,
        status ? String(status).toLowerCase() : 'active',
        id
      ]
    )
    if (hasChitGroupIds) {
      await syncMemberChits(connection, id, chitGroupIds)
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  await notifyNewChits(id, addedChitIds)
  await logRequestActivity(req, 'member_updated', `Member ${name} was updated`, 'member', id)
  const member = await findMember(id)
  const chits = await findMemberChits(id)
  return ok(res, mapMember(member, chits), 'Member updated')
}

export async function deleteMember(req: Request, res: Response) {
  const id = Number(req.params.id)
  await pool.execute('DELETE FROM members WHERE id = ?', [id])
  return ok(res, { id }, 'Member deleted')
}
