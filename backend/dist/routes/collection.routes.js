"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const collection_controller_1 = require("../controllers/collection.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.authenticate, collection_controller_1.listCollections);
router.post('/', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN', 'COLLECTOR', 'ACCOUNTANT'), collection_controller_1.createCollection);
exports.default = router;
