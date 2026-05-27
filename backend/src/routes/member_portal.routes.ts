import { Router } from 'express'
import {
  getMemberAuctionStatus,
  getMemberChits,
  getMemberDashboard,
  getMemberDues,
  getMemberPayments,
  getMemberReceipts
} from '../controllers/member_portal.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/dashboard', authenticate, authorize('MEMBER'), getMemberDashboard)
router.get('/chits', authenticate, authorize('MEMBER'), getMemberChits)
router.get('/payments', authenticate, authorize('MEMBER'), getMemberPayments)
router.get('/dues', authenticate, authorize('MEMBER'), getMemberDues)
router.get('/receipts', authenticate, authorize('MEMBER'), getMemberReceipts)
router.get('/auction-status', authenticate, authorize('MEMBER'), getMemberAuctionStatus)

export default router
