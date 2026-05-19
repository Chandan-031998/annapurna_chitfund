"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listLedger = listLedger;
exports.createLedgerEntry = createLedgerEntry;
const db_1 = require("../config/db");
const response_1 = require("../utils/response");
function mapLedger(item) {
    return {
        id: item.id,
        type: String(item.entry_type).toUpperCase(),
        title: item.title || '',
        amount: Number(item.amount || 0),
        entryDate: item.entry_date,
        notes: item.description
    };
}
async function listLedger(_req, res) {
    const [items] = await db_1.pool.query('SELECT * FROM ledger_entries ORDER BY created_at DESC');
    let runningBalance = 0;
    const chronological = [...items].reverse().map((item) => {
        const mapped = mapLedger(item);
        runningBalance += mapped.type === 'CREDIT' ? mapped.amount : -mapped.amount;
        return { ...mapped, runningBalance };
    }).reverse();
    return (0, response_1.ok)(res, chronological, 'Ledger loaded');
}
async function createLedgerEntry(req, res) {
    const { type, title, amount, entryDate, notes } = req.body;
    if (!type || !title || !amount || !entryDate) {
        return (0, response_1.fail)(res, 400, 'Type, title, amount and date are required');
    }
    const [result] = await db_1.pool.execute(`INSERT INTO ledger_entries (entry_type, title, amount, entry_date, description)
     VALUES (?, ?, ?, ?, ?)`, [String(type).toLowerCase(), title, amount, entryDate, notes || null]);
    const [rows] = await db_1.pool.query('SELECT * FROM ledger_entries WHERE id = ? LIMIT 1', [result.insertId]);
    return (0, response_1.created)(res, mapLedger(rows[0]), 'Ledger entry created');
}
