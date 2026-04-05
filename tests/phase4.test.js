const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const FinancialRecord = require('../src/models/record.model');
require('dotenv').config();

describe('Phase 4: Dashboard & Analytics Endpoints', () => {
    let adminToken, viewerToken, analystToken;
    let seededRecord1, seededRecord2, seededRecord3, deletedRecord;

    beforeAll(async () => {
        const url = process.env.MONGODB_URI + '_test';
        if (mongoose.connection.readyState === 1) await mongoose.disconnect();
        await mongoose.connect(url);
        await User.deleteMany({});
        await FinancialRecord.deleteMany({});

        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('Pass@1234', 10);
        
        const adminUser = await User.create({ name: 'Admin', email: 'admin@finance.dev', password: hashedPassword, role: 'ADMIN' });
        await User.create({ name: 'Viewer', email: 'viewer@finance.dev', password: hashedPassword, role: 'VIEWER' });
        await User.create({ name: 'Analyst', email: 'analyst@finance.dev', password: hashedPassword, role: 'ANALYST' });

        const res1 = await request(app).post('/api/v1/auth/login').send({ email: 'admin@finance.dev', password: 'Pass@1234' });
        adminToken = res1.body.token;

        const res2 = await request(app).post('/api/v1/auth/login').send({ email: 'viewer@finance.dev', password: 'Pass@1234' });
        viewerToken = res2.body.token;

        const res3 = await request(app).post('/api/v1/auth/login').send({ email: 'analyst@finance.dev', password: 'Pass@1234' });
        analystToken = res3.body.token;

        // Seed 3 active records and 1 deleted record
        seededRecord1 = await FinancialRecord.create({ amount: 1000, type: 'INCOME', category: 'Salary', date: '2025-01-10', createdBy: adminUser._id });
        seededRecord2 = await FinancialRecord.create({ amount: 200, type: 'EXPENSE', category: 'Food', date: '2025-01-15', createdBy: adminUser._id });
        seededRecord3 = await FinancialRecord.create({ amount: 300, type: 'EXPENSE', category: 'Rent', date: '2025-02-10', createdBy: adminUser._id });
        
        deletedRecord = await FinancialRecord.create({ amount: 500, type: 'EXPENSE', category: 'Misc', date: '2025-01-05', createdBy: adminUser._id, isDeleted: true });
    });

    afterAll(async () => {
        await User.deleteMany({});
        await FinancialRecord.deleteMany({});
        await mongoose.connection.close();
    });

    // T4.1 - Summary: correct totals from seed data
    test('T4.1 — Summary: correct totals from seed data', async () => {
        const res = await request(app).get('/api/v1/dashboard/summary').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.total_income).toBe(1000);
        expect(res.body.total_expenses).toBe(500); // 200 + 300
        expect(res.body.net_balance).toBe(500);
        expect(res.body.record_count).toBe(3);
    });

    // T4.2 - Summary: date-scoped
    test('T4.2 — Summary: date-scoped', async () => {
        const res = await request(app).get('/api/v1/dashboard/summary?from=2025-01-01&to=2025-01-31').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.total_income).toBe(1000);
        expect(res.body.total_expenses).toBe(200);
        expect(res.body.record_count).toBe(2);
    });

    // T4.3 - Summary: VIEWER can access
    test('T4.3 — Summary: VIEWER can access', async () => {
        const res = await request(app).get('/api/v1/dashboard/summary').set('Authorization', `Bearer ${viewerToken}`);
        expect(res.status).toBe(200);
    });

    // T4.4 - Summary: unauthenticated is blocked
    test('T4.4 — Summary: unauthenticated is blocked', async () => {
        const res = await request(app).get('/api/v1/dashboard/summary');
        expect(res.status).toBe(401);
    });

    // T4.5 - Recent: returns last 10 by default
    test('T4.5 — Recent: returns last 10 by default', async () => {
        const res = await request(app).get('/api/v1/dashboard/recent').set('Authorization', `Bearer ${viewerToken}`);
        expect(res.status).toBe(200);
        expect(res.body.records.length).toBeLessThanOrEqual(10);
        expect(res.body.records.find(r => r.id === deletedRecord._id.toString())).toBeUndefined();
    });

    // T4.6 - Recent: custom limit
    test('T4.6 — Recent: custom limit', async () => {
        const res = await request(app).get('/api/v1/dashboard/recent?limit=2').set('Authorization', `Bearer ${viewerToken}`);
        expect(res.status).toBe(200);
        expect(res.body.records.length).toBe(2);
    });

    // T4.7 - Categories: correct grouping
    test('T4.7 — Categories: correct grouping', async () => {
        const res = await request(app).get('/api/v1/dashboard/categories').set('Authorization', `Bearer ${analystToken}`);
        expect(res.status).toBe(200);
        
        expect(res.body.income).toBeDefined();
        expect(res.body.expense).toBeDefined();

        const salary = res.body.income.find(i => i.category === 'Salary');
        expect(salary.total).toBe(1000);
        expect(salary.count).toBe(1);

        const food = res.body.expense.find(e => e.category === 'Food');
        expect(food.total).toBe(200);
    });

    // T4.8 - Categories: VIEWER is blocked
    test('T4.8 — Categories: VIEWER is blocked', async () => {
        const res = await request(app).get('/api/v1/dashboard/categories').set('Authorization', `Bearer ${viewerToken}`);
        expect(res.status).toBe(403);
    });

    // T4.9 - Categories: date-scoped
    test('T4.9 — Categories: date-scoped', async () => {
        const res = await request(app).get('/api/v1/dashboard/categories?from=2025-02-01&to=2025-02-28').set('Authorization', `Bearer ${analystToken}`);
        expect(res.status).toBe(200);
        
        // Income in Feb is empty based on seed
        expect(res.body.income.length).toBe(0);
        expect(res.body.expense.length).toBe(1);
        expect(res.body.expense[0].category).toBe('Rent');
    });

    // T4.10 - Trends: monthly granularity
    test('T4.10 — Trends: monthly granularity', async () => {
        const res = await request(app).get('/api/v1/dashboard/trends?granularity=monthly&from=2025-01-01&to=2025-03-01').set('Authorization', `Bearer ${analystToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(3); // Jan, Feb, Mar zero-filled

        const jan = res.body.data.find(d => d.period === '2025-01');
        expect(jan.income).toBe(1000);
        expect(jan.expense).toBe(200);

        const mar = res.body.data.find(d => d.period === '2025-03');
        expect(mar.income).toBe(0);
        expect(mar.expense).toBe(0);
    });

    // T4.11 - Trends: weekly granularity
    test('T4.11 — Trends: weekly granularity', async () => {
        const res = await request(app).get('/api/v1/dashboard/trends?granularity=weekly&from=2025-01-01&to=2025-01-31').set('Authorization', `Bearer ${analystToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data[0].period).toMatch(/2025-W\d{2}/);
    });

    // T4.12 - Trends: custom date range
    test('T4.12 — Trends: custom date range', async () => {
        const res = await request(app).get('/api/v1/dashboard/trends?from=2025-01-01&to=2025-03-31&granularity=monthly').set('Authorization', `Bearer ${analystToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(3);
    });

    // T4.13 - Trends: VIEWER is blocked
    test('T4.13 — Trends: VIEWER is blocked', async () => {
        const res = await request(app).get('/api/v1/dashboard/trends').set('Authorization', `Bearer ${viewerToken}`);
        expect(res.status).toBe(403);
    });

    // T4.14 - Invalid date range
    test('T4.14 — Invalid date range', async () => {
        const res = await request(app).get('/api/v1/dashboard/summary?from=2025-06-01&to=2025-01-01').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    // T4.15 - Soft-deleted records excluded from all analytics
    test('T4.15 — Soft-deleted records excluded from all analytics', async () => {
        const res1 = await request(app).get('/api/v1/dashboard/summary').set('Authorization', `Bearer ${adminToken}`);
        expect(res1.body.total_expenses).toBe(500); // Does NOT include the deleted record of 500

        const res2 = await request(app).get('/api/v1/dashboard/categories').set('Authorization', `Bearer ${analystToken}`);
        const misc = res2.body.expense.find(e => e.category === 'Misc');
        expect(misc).toBeUndefined();
    });
});
