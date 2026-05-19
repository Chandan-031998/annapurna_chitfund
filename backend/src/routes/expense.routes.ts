import { Router } from 'express'
import { createExpense, listExpenses } from '../controllers/expense.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, listExpenses)
router.post('/', authenticate, authorize('ADMIN', 'ACCOUNTANT'), createExpense)

export default router
