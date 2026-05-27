import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { pool } from '../config/db'
import { logActivity } from '../services/activity.service'
import { signToken } from '../utils/jwt'

type DbUser = RowDataPacket & {
  id: number
  full_name: string
  email: string
  mobile: string
  password: string
  role: string
  address?: string | null
}

function normalizeRole(role?: string | null) {
  const normalized = String(role || 'member').toLowerCase()
  if (['admin', 'member'].includes(normalized)) {
    return normalized
  }
  return 'member'
}

function toFrontendUser(user: DbUser) {
  return {
    ...user,
    name: user.full_name,
    phone: user.mobile,
    role: normalizeRole(user.role).toUpperCase()
  }
}

async function ensureRegisteredMemberProfile(user: DbUser) {
  if (normalizeRole(user.role) !== 'member') return

  const [existing] = await pool.query<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM members WHERE mobile = ? OR email = ? LIMIT 1',
    [user.mobile, user.email]
  )

  if (existing[0]) return

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO members (member_code, full_name, email, mobile, address, status, joining_date)
     VALUES (?, ?, ?, ?, ?, 'active', CURDATE())`,
    [`MEM-${Date.now().toString().slice(-6)}`, user.full_name, user.email, user.mobile, user.address || null]
  )

  await pool.execute(
    `INSERT INTO notifications (user_id, member_id, title, message, sent_to, notification_type, status)
     VALUES (?, ?, 'Member profile created', 'Your Annapurna chit fund member profile has been created.', ?, 'push', 'sent')`,
    [user.id, result.insertId, user.email || user.mobile]
  )
}

export const register = async (req: Request, res: Response) => {
  try {
    const { full_name, name, email, mobile, phone, password, role, address } = req.body
    const displayName = full_name || name
    const displayMobile = mobile || phone || `M-${Date.now()}`

    if (!displayName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const [result] = await pool.execute(
      'INSERT INTO users (full_name, email, mobile, password, role, address) VALUES (?, ?, ?, ?, ?, ?)',
      [displayName, email, displayMobile, passwordHash, normalizeRole(role), address || null]
    )
    const insertId = Number((result as { insertId?: number }).insertId)
    const [rows] = await pool.execute<DbUser[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [insertId])
    const user = rows[0]
    await ensureRegisteredMemberProfile(user)
    await logActivity({
      userId: user.id,
      role: user.role,
      action: 'login',
      description: `${user.full_name} logged in`,
      entityType: 'user',
      entityId: user.id,
      ipAddress: req.ip
    })

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role
    })

    return res.status(201).json({
      success: true,
      token,
      user: toFrontendUser(user)
    })
  } catch (error) {
    console.error('REGISTER ERROR', error)
    return res.status(500).json({
      success: false,
      message: 'Registration failed'
    })
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }

    const [rows] = await pool.execute<DbUser[]>('SELECT * FROM users WHERE email = ? LIMIT 1', [email])

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email'
      })
    }

    const user = rows[0]

    const passwordMatches = user.password.startsWith('$2')
      ? await bcrypt.compare(password, user.password)
      : password === user.password

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      })
    }

    await ensureRegisteredMemberProfile(user)

    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role
    })

    return res.json({
      success: true,
      token,
      user: toFrontendUser(user)
    })
  } catch (error) {
    console.error('LOGIN ERROR', error)
    return res.status(500).json({
      success: false,
      message: 'Login failed'
    })
  }
}

export const profile = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication is required'
      })
    }

    const [rows] = await pool.execute<DbUser[]>('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id])
    const user = rows[0]

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      })
    }

    return res.json({
      success: true,
      user: toFrontendUser(user)
    })
  } catch (error) {
    console.error('PROFILE ERROR', error)
    return res.status(500).json({
      success: false,
      message: 'Profile fetch failed'
    })
  }
}
