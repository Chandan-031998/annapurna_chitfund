import cors from 'cors'
import dotenv from 'dotenv'
import express, { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import morgan from 'morgan'
import authRoutes from './routes/auth.routes'
import memberRoutes from './routes/member.routes'
import collectionRoutes from './routes/collection.routes'
import groupRoutes from './routes/group.routes'
import auctionRoutes from './routes/auction.routes'
import expenseRoutes from './routes/expense.routes'
import ledgerRoutes from './routes/ledger.routes'
import reportRoutes from './routes/report.routes'
import notificationRoutes from './routes/notification.routes'
import { fail } from './utils/response'

dotenv.config()

const app = express()
const allowedOrigins = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean)

app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true
}))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('dev'))

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'Annapurna API running' })
})

app.use('/api/auth', authRoutes)
app.use('/api/members', memberRoutes)
app.use('/api/groups', groupRoutes)
app.use('/api/collections', collectionRoutes)
app.use('/api/auctions', auctionRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/ledger', ledgerRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/notifications', notificationRoutes)

app.use((_req, res) => fail(res, 404, 'API route not found'))

app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
  return fail(res, 500, error.message || 'Internal server error')
})

export default app
