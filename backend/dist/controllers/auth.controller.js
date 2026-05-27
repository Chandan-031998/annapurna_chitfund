"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.profile = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../config/db");
const activity_service_1 = require("../services/activity.service");
const jwt_1 = require("../utils/jwt");
function normalizeRole(role) {
    const normalized = String(role || 'member').toLowerCase();
    if (['admin', 'member'].includes(normalized)) {
        return normalized;
    }
    return 'member';
}
function toFrontendUser(user) {
    return {
        ...user,
        name: user.full_name,
        phone: user.mobile,
        role: normalizeRole(user.role).toUpperCase()
    };
}
async function ensureRegisteredMemberProfile(user) {
    if (normalizeRole(user.role) !== 'member')
        return;
    const [existing] = await db_1.pool.query('SELECT id FROM members WHERE mobile = ? OR email = ? LIMIT 1', [user.mobile, user.email]);
    if (existing[0])
        return;
    const [result] = await db_1.pool.execute(`INSERT INTO members (member_code, full_name, email, mobile, address, status, joining_date)
     VALUES (?, ?, ?, ?, ?, 'active', CURDATE())`, [`MEM-${Date.now().toString().slice(-6)}`, user.full_name, user.email, user.mobile, user.address || null]);
    await db_1.pool.execute(`INSERT INTO notifications (user_id, member_id, title, message, sent_to, notification_type, status)
     VALUES (?, ?, 'Member profile created', 'Your Annapurna chit fund member profile has been created.', ?, 'push', 'sent')`, [user.id, result.insertId, user.email || user.mobile]);
}
const register = async (req, res) => {
    try {
        const { full_name, name, email, mobile, phone, password, role, address } = req.body;
        const displayName = full_name || name;
        const displayMobile = mobile || phone || `M-${Date.now()}`;
        if (!displayName || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, email and password are required'
            });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const [result] = await db_1.pool.execute('INSERT INTO users (full_name, email, mobile, password, role, address) VALUES (?, ?, ?, ?, ?, ?)', [displayName, email, displayMobile, passwordHash, normalizeRole(role), address || null]);
        const insertId = Number(result.insertId);
        const [rows] = await db_1.pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [insertId]);
        const user = rows[0];
        await ensureRegisteredMemberProfile(user);
        await (0, activity_service_1.logActivity)({
            userId: user.id,
            role: user.role,
            action: 'login',
            description: `${user.full_name} logged in`,
            entityType: 'user',
            entityId: user.id,
            ipAddress: req.ip
        });
        const token = (0, jwt_1.signToken)({
            id: user.id,
            email: user.email,
            role: user.role
        });
        return res.status(201).json({
            success: true,
            token,
            user: toFrontendUser(user)
        });
    }
    catch (error) {
        console.error('REGISTER ERROR', error);
        return res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        const [rows] = await db_1.pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
        if (!rows.length) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email'
            });
        }
        const user = rows[0];
        const passwordMatches = user.password.startsWith('$2')
            ? await bcryptjs_1.default.compare(password, user.password)
            : password === user.password;
        if (!passwordMatches) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }
        await ensureRegisteredMemberProfile(user);
        const token = (0, jwt_1.signToken)({
            id: user.id,
            email: user.email,
            role: user.role
        });
        return res.json({
            success: true,
            token,
            user: toFrontendUser(user)
        });
    }
    catch (error) {
        console.error('LOGIN ERROR', error);
        return res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
};
exports.login = login;
const profile = async (req, res) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication is required'
            });
        }
        const [rows] = await db_1.pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
        const user = rows[0];
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        return res.json({
            success: true,
            user: toFrontendUser(user)
        });
    }
    catch (error) {
        console.error('PROFILE ERROR', error);
        return res.status(500).json({
            success: false,
            message: 'Profile fetch failed'
        });
    }
};
exports.profile = profile;
