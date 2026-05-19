import { Router } from 'express'
import { createGroup, deleteGroup, getGroup, listGroups, updateGroup } from '../controllers/group.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, listGroups)
router.get('/:id', authenticate, getGroup)
router.post('/', authenticate, authorize('ADMIN', 'ACCOUNTANT'), createGroup)
router.put('/:id', authenticate, authorize('ADMIN', 'ACCOUNTANT'), updateGroup)
router.delete('/:id', authenticate, authorize('ADMIN'), deleteGroup)

export default router
