import { Router } from 'express'
import { createPaymentReminder, listNotifications } from '../controllers/notification.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, listNotifications)
router.post('/payment-reminder', authenticate, authorize('ADMIN'), createPaymentReminder)

export default router
