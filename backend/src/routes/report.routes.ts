import { Router } from 'express'
import { getReports, logReportExport } from '../controllers/report.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, authorize('ADMIN'), getReports)
router.post('/export-log', authenticate, authorize('ADMIN'), logReportExport)

export default router
