"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listExpenses = listExpenses;
exports.createExpense = createExpense;
const db_1 = require("../config/db");
const activity_service_1 = require("../services/activity.service");
const response_1 = require("../utils/response");
function mapExpense(item) {
    return {
        id: item.id,
        title: item.title,
        category: item.category,
        amount: Number(item.amount),
        expenseDate: item.expense_date,
        paymentMode: item.payment_mode,
        notes: item.remarks
    };
}
async function listExpenses(_req, res) {
    const [items] = await db_1.pool.query('SELECT * FROM expenses ORDER BY created_at DESC');
    return (0, response_1.ok)(res, items.map(mapExpense), 'Expenses loaded');
}
async function createExpense(req, res) {
    const { title, category, amount, expenseDate, notes } = req.body;
    if (!title || !amount || !expenseDate) {
        return (0, response_1.fail)(res, 400, 'Title, amount and date are required');
    }
    const [result] = await db_1.pool.execute(`INSERT INTO expenses (title, category, amount, expense_date, payment_mode, remarks)
     VALUES (?, ?, ?, ?, ?, ?)`, [title, category || 'General', amount, expenseDate, String(req.body.paymentMode || 'cash').toLowerCase(), notes || null]);
    await db_1.pool.execute(`INSERT INTO ledger_entries (entry_type, title, amount, entry_date, description)
     VALUES ('debit', ?, ?, ?, ?)`, [`Expense: ${title}`, amount, expenseDate, notes || null]);
    await (0, activity_service_1.logRequestActivity)(req, 'expense_added', `Expense ${title} added`, 'expense', result.insertId);
    const [rows] = await db_1.pool.query('SELECT * FROM expenses WHERE id = ? LIMIT 1', [result.insertId]);
    return (0, response_1.created)(res, mapExpense(rows[0]), 'Expense created');
}
