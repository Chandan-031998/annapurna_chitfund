import { Router } from 'express'
import {
  addMemberChits,
  createMember,
  deleteMember,
  deleteMemberChit,
  getMember,
  getMemberChits,
  listMembers,
  updateMember
} from '../controllers/member.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, authorize('ADMIN'), listMembers)
router.get('/:id/chits', authenticate, authorize('ADMIN'), getMemberChits)
router.get('/:id', authenticate, authorize('ADMIN'), getMember)
router.post('/:id/chits', authenticate, authorize('ADMIN'), addMemberChits)
router.delete('/:id/chits/:chitGroupId', authenticate, authorize('ADMIN'), deleteMemberChit)
router.post('/', authenticate, authorize('ADMIN'), createMember)
router.put('/:id', authenticate, authorize('ADMIN'), updateMember)
router.delete('/:id', authenticate, authorize('ADMIN'), deleteMember)

export default router
