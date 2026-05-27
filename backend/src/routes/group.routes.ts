import { Router } from 'express'
import { createGroup, deleteGroup, getGroup, listGroups, updateGroup } from '../controllers/group.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, authorize('ADMIN'), listGroups)
router.get('/:id', authenticate, authorize('ADMIN'), getGroup)
router.post('/', authenticate, authorize('ADMIN'), createGroup)
router.put('/:id', authenticate, authorize('ADMIN'), updateGroup)
router.delete('/:id', authenticate, authorize('ADMIN'), deleteGroup)

export default router
