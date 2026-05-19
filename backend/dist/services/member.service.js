"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberService = void 0;
const db_1 = require("../config/db");
exports.memberService = {
    all() {
        return db_1.prisma.member.findMany({ orderBy: { created_at: 'desc' } });
    }
};
