import { Request, Response } from 'express'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { notifyMemberJoinedChit } from '../services/notification.service'
import { created, fail, ok } from '../utils/response'

type GroupRow = RowDataPacket & {
  id: number
  group_name: string
  monthly_amount: string | number
  total_members: number
  duration_months: number
  status: string | null
  start_date: Date | string
  created_at: Date | string
}

type GroupMemberRow = RowDataPacket & {
  id: number
  full_name: string
  mobile: string
}

async function notifyMembersJoinedGroup(memberIds: number[], groupId: number) {
  await Promise.all(memberIds.map((memberId) => notifyMemberJoinedChit(memberId, groupId)))
}

function mapGroup(group: GroupRow, members: GroupMemberRow[] = []) {
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
  }
}

async function findGroup(id: number) {
  const [groups] = await pool.query<GroupRow[]>('SELECT * FROM chit_groups WHERE id = ? LIMIT 1', [id])
  if (!groups[0]) return null
  const [members] = await pool.query<GroupMemberRow[]>(
    `SELECT DISTINCT m.id, m.full_name, m.mobile
     FROM members m
     LEFT JOIN member_chits mc ON mc.member_id = m.id AND mc.chit_group_id = ?
     WHERE mc.id IS NOT NULL OR m.group_id = ?
     ORDER BY m.full_name`,
    [id, id]
  )
  return mapGroup(groups[0], members)
}

export async function listGroups(_req: Request, res: Response) {
  const [groups] = await pool.query<GroupRow[]>('SELECT * FROM chit_groups ORDER BY created_at DESC')
  const mapped = await Promise.all(groups.map((group) => findGroup(group.id)))
  return ok(res, mapped.filter(Boolean), 'Groups loaded')
}

export async function getGroup(req: Request, res: Response) {
  const group = await findGroup(Number(req.params.id))
  if (!group) return fail(res, 404, 'Group not found')
  return ok(res, group, 'Group loaded')
}

export async function createGroup(req: Request, res: Response) {
  const { name, monthlyAmount, totalMembers, durationMonths, startDate, status, memberIds = [] } = req.body
  if (!name || !monthlyAmount || !totalMembers || !durationMonths || !startDate) {
    return fail(res, 400, 'Name, monthly amount, members, duration and start date are required')
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO chit_groups (group_name, monthly_amount, total_members, duration_months, start_date, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, monthlyAmount, Number(totalMembers), Number(durationMonths), startDate, String(status || 'active').toLowerCase()]
  )

  if (Array.isArray(memberIds) && memberIds.length) {
    const ids = [...new Set(memberIds.map(Number).filter((memberId) => Number.isInteger(memberId) && memberId > 0))]
    if (ids.length) {
      await pool.query(
        `INSERT IGNORE INTO member_chits (member_id, chit_group_id, join_date)
         VALUES ${ids.map(() => '(?, ?, CURDATE())').join(', ')}`,
        ids.flatMap((memberId) => [memberId, result.insertId])
      )
      await pool.query(`UPDATE members SET group_id = ? WHERE group_id IS NULL AND id IN (${ids.map(() => '?').join(',')})`, [result.insertId, ...ids])
      await notifyMembersJoinedGroup(ids, result.insertId)
    }
  }

  const group = await findGroup(result.insertId)
  return created(res, group, 'Group created')
}

export async function updateGroup(req: Request, res: Response) {
  const id = Number(req.params.id)
  const { name, monthlyAmount, totalMembers, durationMonths, startDate, status, memberIds } = req.body

  await pool.execute(
    `UPDATE chit_groups
     SET group_name = COALESCE(?, group_name),
         monthly_amount = COALESCE(?, monthly_amount),
         total_members = COALESCE(?, total_members),
         duration_months = COALESCE(?, duration_months),
         start_date = COALESCE(?, start_date),
         status = COALESCE(?, status)
     WHERE id = ?`,
    [
      name || null,
      monthlyAmount || null,
      totalMembers ? Number(totalMembers) : null,
      durationMonths ? Number(durationMonths) : null,
      startDate || null,
      status ? String(status).toLowerCase() : null,
      id
    ]
  )

  if (Array.isArray(memberIds)) {
    const ids = [...new Set(memberIds.map(Number).filter((memberId) => Number.isInteger(memberId) && memberId > 0))]
    const [existingRows] = await pool.query<(RowDataPacket & { member_id: number })[]>('SELECT member_id FROM member_chits WHERE chit_group_id = ?', [id])
    const existingIds = existingRows.map((row) => row.member_id)
    const addedIds = ids.filter((memberId) => !existingIds.includes(memberId))
    await pool.execute('DELETE FROM member_chits WHERE chit_group_id = ?', [id])
    await pool.execute(
      `UPDATE members m
       SET group_id = (
         SELECT mc.chit_group_id
         FROM member_chits mc
         WHERE mc.member_id = m.id
         ORDER BY mc.id
         LIMIT 1
       )
       WHERE m.group_id = ?`,
      [id]
    )
    if (ids.length) {
      await pool.query(
        `INSERT IGNORE INTO member_chits (member_id, chit_group_id, join_date)
         VALUES ${ids.map(() => '(?, ?, CURDATE())').join(', ')}`,
        ids.flatMap((memberId) => [memberId, id])
      )
      await pool.query(`UPDATE members SET group_id = ? WHERE group_id IS NULL AND id IN (${ids.map(() => '?').join(',')})`, [id, ...ids])
      await notifyMembersJoinedGroup(addedIds, id)
    }
  }

  const group = await findGroup(id)
  if (!group) return fail(res, 404, 'Group not found')
  return ok(res, group, 'Group updated')
}

export async function deleteGroup(req: Request, res: Response) {
  const id = Number(req.params.id)
  await pool.execute('DELETE FROM member_chits WHERE chit_group_id = ?', [id])
  await pool.execute(
    `UPDATE members m
     SET group_id = (
       SELECT mc.chit_group_id
       FROM member_chits mc
       WHERE mc.member_id = m.id
       ORDER BY mc.id
       LIMIT 1
     )
     WHERE m.group_id = ?`,
    [id]
  )
  await pool.execute('DELETE FROM chit_groups WHERE id = ?', [id])
  return ok(res, { id }, 'Group deleted')
}
