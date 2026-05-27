"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const member_routes_1 = __importDefault(require("./routes/member.routes"));
const collection_routes_1 = __importDefault(require("./routes/collection.routes"));
const group_routes_1 = __importDefault(require("./routes/group.routes"));
const auction_routes_1 = __importDefault(require("./routes/auction.routes"));
const expense_routes_1 = __importDefault(require("./routes/expense.routes"));
const ledger_routes_1 = __importDefault(require("./routes/ledger.routes"));
const report_routes_1 = __importDefault(require("./routes/report.routes"));
const notification_routes_1 = __importDefault(require("./routes/notification.routes"));
const member_portal_routes_1 = __importDefault(require("./routes/member_portal.routes"));
const db_1 = require("./config/db");
const response_1 = require("./utils/response");
dotenv_1.default.config();
const app = (0, express_1.default)();
const databaseReady = (0, db_1.connectDatabase)();
const allowedOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express_1.default.json({ limit: '1mb' }));
app.use((0, morgan_1.default)('dev'));
app.use(async (_req, _res, next) => {
    try {
        await databaseReady;
        next();
    }
    catch (error) {
        next(error);
    }
});
app.get('/', (_req, res) => {
    res.json({
        success: true,
        message: 'Annapurna API running successfully'
    });
});
app.get('/health', (_req, res) => {
    res.json({ success: true, message: 'Annapurna API running' });
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/member', member_portal_routes_1.default);
app.use('/api/members', member_routes_1.default);
app.use('/api/groups', group_routes_1.default);
app.use('/api/collections', collection_routes_1.default);
app.use('/api/auctions', auction_routes_1.default);
app.use('/api/expenses', expense_routes_1.default);
app.use('/api/ledger', ledger_routes_1.default);
app.use('/api/reports', report_routes_1.default);
app.use('/api/notifications', notification_routes_1.default);
app.use((error, _req, res, _next) => {
    return (0, response_1.fail)(res, 500, error.message || 'Internal server error');
});
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: 'API route not found'
    });
});
exports.default = app;
