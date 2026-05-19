"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.profile = exports.login = exports.register = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const promise_1 = __importDefault(require("mysql2/promise"));
dotenv_1.default.config();
const pool = process.env.DATABASE_URL
    ? promise_1.default.createPool(process.env.DATABASE_URL)
    : promise_1.default.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'annapurna',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
function normalizeRole(role) {
    const normalized = String(role || 'member').toLowerCase();
    if (['admin', 'collector', 'accountant', 'member'].includes(normalized)) {
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
        const [result] = await pool.execute('INSERT INTO users (full_name, email, mobile, password, role, address) VALUES (?, ?, ?, ?, ?, ?)', [displayName, email, displayMobile, password, normalizeRole(role), address || null]);
        const insertId = Number(result.insertId);
        const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [insertId]);
        const user = rows[0];
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role
        }, process.env.JWT_SECRET || 'secret', {
            expiresIn: '7d'
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
        console.log('LOGIN REQUEST', req.body);
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
        console.log('DB USER', rows);
        if (!rows.length) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email'
            });
        }
        const user = rows[0];
        if (password !== user.password) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password'
            });
        }
        const token = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role
        }, process.env.JWT_SECRET || 'secret', {
            expiresIn: '7d'
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
        const [rows] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
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
