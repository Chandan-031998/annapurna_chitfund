"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const db_1 = require("../config/db");
exports.authService = {
    findByEmail(email) {
        return db_1.prisma.user.findUnique({ where: { email } });
    }
};
