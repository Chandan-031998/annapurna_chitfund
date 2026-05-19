"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notification_controller_1 = require("../controllers/notification.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.authenticate, notification_controller_1.listNotifications);
router.post('/payment-reminder', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN', 'COLLECTOR', 'ACCOUNTANT'), notification_controller_1.createPaymentReminder);
exports.default = router;
