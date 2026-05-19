import { Router } from 'express'
import { createMember, deleteMember, getMember, listMembers, updateMember } from '../controllers/member.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, listMembers)
router.get('/:id', authenticate, getMember)
router.post('/', authenticate, authorize('ADMIN', 'ACCOUNTANT'), createMember)
router.put('/:id', authenticate, authorize('ADMIN', 'ACCOUNTANT'), updateMember)
router.delete('/:id', authenticate, authorize('ADMIN'), deleteMember)

export default router
