import { Router } from 'express'
import { createCollection, listCollections } from '../controllers/collection.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, listCollections)
router.post('/', authenticate, authorize('ADMIN', 'COLLECTOR', 'ACCOUNTANT'), createCollection)

export default router
