"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.authorize = authorize;
const db_1 = require("../config/db");
const jwt_1 = require("../utils/jwt");
const response_1 = require("../utils/response");
async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
        return (0, response_1.fail)(res, 401, 'Authentication token is required');
    }
    try {
        const payload = (0, jwt_1.verifyToken)(token);
        const user = await db_1.prisma.user.findUnique({
            where: { id: payload.id },
            select: { id: true, full_name: true, email: true, role: true }
        });
        if (!user) {
            return (0, response_1.fail)(res, 401, 'User session is no longer valid');
        }
        req.user = {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: String(user.role || 'member').toUpperCase()
        };
        return next();
    }
    catch {
        return (0, response_1.fail)(res, 401, 'Invalid or expired token');
    }
}
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return (0, response_1.fail)(res, 401, 'Authentication is required');
        }
        if (!roles.map((role) => role.toUpperCase()).includes(req.user.role.toUpperCase())) {
            return (0, response_1.fail)(res, 403, 'You do not have permission to perform this action');
        }
        return next();
    };
}
