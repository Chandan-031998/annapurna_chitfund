import { Router } from 'express'
import { createExpense, listExpenses } from '../controllers/expense.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, authorize('ADMIN'), listExpenses)
router.post('/', authenticate, authorize('ADMIN'), createExpense)

export default router
