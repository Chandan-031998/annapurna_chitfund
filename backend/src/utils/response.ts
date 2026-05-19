import { Response } from 'express'

export function ok<T>(res: Response, data: T, message = 'Success') {
  return res.json({ success: true, message, data })
}

export function created<T>(res: Response, data: T, message = 'Created') {
  return res.status(201).json({ success: true, message, data })
}

export function fail(res: Response, status: number, message: string, details?: unknown) {
  return res.status(status).json({ success: false, message, details })
}
