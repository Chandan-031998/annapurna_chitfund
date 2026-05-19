import { Router } from 'express'
import { createLedgerEntry, listLedger } from '../controllers/ledger.controller'
import { authenticate, authorize } from '../middlewares/auth.middleware'

const router = Router()

router.get('/', authenticate, listLedger)
router.post('/', authenticate, authorize('ADMIN', 'ACCOUNTANT'), createLedgerEntry)

export default router
