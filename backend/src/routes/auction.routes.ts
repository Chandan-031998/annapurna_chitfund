import { Router } from 'express'
import { createAuction, listAuctions } from '../controllers/auction.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, authorize('ADMIN'), listAuctions)
router.post('/', authenticate, authorize('ADMIN'), createAuction)

export default router
