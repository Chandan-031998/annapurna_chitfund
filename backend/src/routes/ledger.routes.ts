import { Router } from 'express'
import { createLedgerEntry, listLedger } from '../controllers/ledger.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, authorize('ADMIN'), listLedger)
router.post('/', authenticate, authorize('ADMIN'), createLedgerEntry)

export default router
