"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listExpenses = listExpenses;
exports.createExpense = createExpense;
const db_1 = require("../config/db");
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
    const items = await db_1.prisma.expense.findMany({ orderBy: { created_at: 'desc' } });
    return (0, response_1.ok)(res, items.map(mapExpense), 'Expenses loaded');
}
async function createExpense(req, res) {
    const { title, category, amount, expenseDate, notes } = req.body;
    if (!title || !amount || !expenseDate) {
        return (0, response_1.fail)(res, 400, 'Title, amount and date are required');
    }
    const expense = await db_1.prisma.expense.create({
        data: { title, category: category || 'General', amount, expense_date: new Date(expenseDate), payment_mode: String(req.body.paymentMode || 'cash').toLowerCase(), remarks: notes }
    });
    await db_1.prisma.ledgerEntry.create({
        data: { entry_type: 'debit', title: `Expense: ${title}`, amount, entry_date: new Date(expenseDate), description: notes }
    });
    return (0, response_1.created)(res, mapExpense(expense), 'Expense created');
}
