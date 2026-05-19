"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ledger_controller_1 = require("../controllers/ledger.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.authenticate, ledger_controller_1.listLedger);
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN', 'ACCOUNTANT'), ledger_controller_1.createLedgerEntry);
exports.default = router;
