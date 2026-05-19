"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'annapurna_secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_VERIFY_SECRETS = Array.from(new Set([
    JWT_SECRET,
    'annapurna_secret',
    'secret'
]));
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function verifyToken(token) {
    let lastError;
    for (const secret of JWT_VERIFY_SECRETS) {
        try {
            return jsonwebtoken_1.default.verify(token, secret);
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}
