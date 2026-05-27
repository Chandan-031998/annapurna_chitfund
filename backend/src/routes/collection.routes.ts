import { Router } from 'express'
import { createCollection, deleteCollection, listCollections, updateCollection } from '../controllers/collection.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, authorize('ADMIN'), listCollections)
router.post('/', authenticate, authorize('ADMIN'), createCollection)
router.put('/:id', authenticate, authorize('ADMIN'), updateCollection)
router.delete('/:id', authenticate, authorize('ADMIN'), deleteCollection)

export default router
