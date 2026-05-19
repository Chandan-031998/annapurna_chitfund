"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listLedger = listLedger;
exports.createLedgerEntry = createLedgerEntry;
const db_1 = require("../config/db");
const response_1 = require("../utils/response");
function mapLedger(item) {
    return {
        id: item.id,
        type: item.entry_type.toUpperCase(),
        title: item.title || '',
        amount: Number(item.amount || 0),
        entryDate: item.entry_date,
        notes: item.description
    };
}
async function listLedger(_req, res) {
    const items = await db_1.prisma.ledgerEntry.findMany({ orderBy: { created_at: 'desc' } });
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
    const entry = await db_1.prisma.ledgerEntry.create({
        data: {
            entry_type: String(type).toLowerCase(),
            title,
            amount,
            entry_date: new Date(entryDate),
            description: notes
        }
    });
    return (0, response_1.created)(res, mapLedger(entry), 'Ledger entry created');
}
