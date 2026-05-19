import { Router } from 'express'
import { getReports } from '../controllers/report.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, getReports)

export default router
