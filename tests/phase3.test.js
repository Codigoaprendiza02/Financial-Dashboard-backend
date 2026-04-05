const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const FinancialRecord = require('../src/models/record.model');
require('dotenv').config();

describe('Phase 3: User Management & Financial Records CRUD', () => {
    let adminToken, viewerToken, analystToken;
    let newAdmin, newViewer, newAnalyst;
    let seededRecordId;
    let newUserId;

    beforeAll(async () => {
        const url = process.env.MONGODB_URI + '_phase3_test';
        if (mongoose.connection.readyState === 1) await mongoose.disconnect();
        await mongoose.connect(url);
        await User.deleteMany({});
        await FinancialRecord.deleteMany({});
        
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('Pass@1234', 10);
        
        // Seed users
        newAdmin = await User.create({ name: 'Admin', email: 'admin@finance.dev', password: hashedPassword, role: 'ADMIN' });
        newViewer = await User.create({ name: 'Viewer', email: 'viewer@finance.dev', password: hashedPassword, role: 'VIEWER' });
        newAnalyst = await User.create({ name: 'Analyst', email: 'analyst@finance.dev', password: hashedPassword, role: 'ANALYST' });

        // Get tokens
        const res1 = await request(app).post('/api/v1/auth/login').send({ email: 'admin@finance.dev', password: 'Pass@1234' });
        adminToken = res1.body.token;

        const res2 = await request(app).post('/api/v1/auth/login').send({ email: 'viewer@finance.dev', password: 'Pass@1234' });
        viewerToken = res2.body.token;

        const res3 = await request(app).post('/api/v1/auth/login').send({ email: 'analyst@finance.dev', password: 'Pass@1234' });
        analystToken = res3.body.token;

        // Seed some records
        const record = await FinancialRecord.create({
            amount: 500, type: 'EXPENSE', category: 'Testing', date: '2025-01-15', createdBy: newAdmin._id
        });
        seededRecordId = record._id;
    });

    afterAll(async () => {
        await User.deleteMany({});
        await FinancialRecord.deleteMany({});
        await mongoose.connection.close();
    });

    describe('User Management', () => {
        test('T3.1 — ADMIN can list users', async () => {
            const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThanOrEqual(3);
        });

        test('T3.2 — VIEWER cannot list users', async () => {
            const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${viewerToken}`);
            expect(res.status).toBe(403);
        });

        test('T3.3 — ANALYST cannot list users', async () => {
            const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${analystToken}`);
            expect(res.status).toBe(403);
        });

        test('T3.4 — ADMIN creates a new user', async () => {
            const res = await request(app)
                .post('/api/v1/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'New Analyst', email: 'new@example.com', password: 'Pass@1234', role: 'ANALYST' });
            expect(res.status).toBe(201);
            expect(res.body.role).toBe('ANALYST');
            newUserId = res.body.id;
        });

        test('T3.5 — ADMIN can filter users by status', async () => {
            const res = await request(app).get('/api/v1/users?status=ACTIVE').set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.every(u => u.status === 'ACTIVE')).toBe(true);
        });

        test('T3.6 — ADMIN updates user role', async () => {
            const res = await request(app)
                .patch(`/api/v1/users/${newUserId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ role: 'VIEWER' });
            expect(res.status).toBe(200);
            expect(res.body.role).toBe('VIEWER');
        });

        test('T3.7 — ADMIN deletes a user', async () => {
            const res = await request(app).delete(`/api/v1/users/${newUserId}`).set('Authorization', `Bearer ${adminToken}`);
            expect([200, 204]).toContain(res.status);

            const getRes = await request(app).get(`/api/v1/users/${newUserId}`).set('Authorization', `Bearer ${adminToken}`);
            expect(getRes.status).toBe(404);
        });

        test('T3.8 — Get non-existent user', async () => {
            const dummyId = new mongoose.Types.ObjectId();
            const res = await request(app).get(`/api/v1/users/${dummyId}`).set('Authorization', `Bearer ${adminToken}`);
            expect(res.status).toBe(404);
        });
    });

    describe('Financial Records', () => {
        let createdRecordId;

        test('T3.9 — ADMIN creates a financial record', async () => {
            const res = await request(app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 15000.00, type: 'INCOME', category: 'Salary', date: '2025-05-01', notes: 'May salary' });
            expect(res.status).toBe(201);
            expect(res.body.amount).toBe(15000);
            expect(res.body.createdBy.toString()).toBe(newAdmin._id.toString());
            createdRecordId = res.body.id;
        });

        test('T3.10 — VIEWER cannot create a record', async () => {
            const res = await request(app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${viewerToken}`)
                .send({ amount: 100, type: 'EXPENSE', category: 'Food', date: '2025-05-01' });
            expect(res.status).toBe(403);
        });

        test('T3.11 — ANALYST cannot create a record', async () => {
            const res = await request(app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${analystToken}`)
                .send({ amount: 100, type: 'EXPENSE', category: 'Food', date: '2025-05-01' });
            expect(res.status).toBe(403);
        });

        test('T3.12 — VIEWER can read records', async () => {
            const res = await request(app).get('/api/v1/records').set('Authorization', `Bearer ${viewerToken}`);
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        });

        test('T3.13 — Filter by type', async () => {
            const res = await request(app).get('/api/v1/records?type=INCOME').set('Authorization', `Bearer ${viewerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.every(r => r.type === 'INCOME')).toBe(true);
        });

        test('T3.14 — Filter by category', async () => {
            const res = await request(app).get('/api/v1/records?category=Salary').set('Authorization', `Bearer ${viewerToken}`);
            expect(res.status).toBe(200);
            expect(res.body.data.every(r => r.category === 'Salary')).toBe(true);
        });

        test('T3.15 — Filter by date range', async () => {
            const res = await request(app).get('/api/v1/records?from=2025-05-01&to=2025-05-31').set('Authorization', `Bearer ${viewerToken}`);
            expect(res.status).toBe(200);
            const returnedDatesMonth = new Date(res.body.data[0].date).getMonth();
            expect(returnedDatesMonth).toBe(4); // 0-indexed May
        });

        test('T3.16 — Pagination', async () => {
            await FinancialRecord.create({ amount: 10, type: 'EXPENSE', category: 'A', date: '2025-02-01', createdBy: newAdmin._id });
            await FinancialRecord.create({ amount: 10, type: 'EXPENSE', category: 'B', date: '2025-02-02', createdBy: newAdmin._id });

            const res1 = await request(app).get('/api/v1/records?page=1&limit=1').set('Authorization', `Bearer ${viewerToken}`);
            expect(res1.body.data.length).toBe(1);

            const res2 = await request(app).get('/api/v1/records?page=2&limit=1').set('Authorization', `Bearer ${viewerToken}`);
            expect(res2.body.data.length).toBe(1);
            expect(res1.body.data[0].id).not.toBe(res2.body.data[0].id);
        });

        test('T3.17 — Sorting', async () => {
            const resAsc = await request(app).get('/api/v1/records?sort=amount&order=asc').set('Authorization', `Bearer ${viewerToken}`);
            const resDesc = await request(app).get('/api/v1/records?sort=amount&order=desc').set('Authorization', `Bearer ${viewerToken}`);
            expect(resAsc.status).toBe(200);
            expect(resAsc.body.data[0].amount).toBeLessThanOrEqual(resAsc.body.data[resAsc.body.data.length-1].amount);
            expect(resDesc.body.data[0].amount).toBeGreaterThanOrEqual(resDesc.body.data[resDesc.body.data.length-1].amount);
        });

        test('T3.18 — Validation: invalid amount', async () => {
            const res = await request(app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: -500, type: 'INCOME', category: 'Salary', date: '2025-05-01' });
            expect(res.status).toBe(400);
        });

        test('T3.19 — Validation: missing required fields', async () => {
            const res = await request(app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 100 });
            expect(res.status).toBe(400);
        });

        test('T3.20 — Validation: invalid date format', async () => {
            const res = await request(app)
                .post('/api/v1/records')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ amount: 100, type: 'INCOME', category: 'Salary', date: 'not-a-date' });
            expect(res.status).toBe(400);
        });

        test('T3.21 — ADMIN soft deletes a record', async () => {
            const res = await request(app).delete(`/api/v1/records/${seededRecordId}`).set('Authorization', `Bearer ${adminToken}`);
            expect([200, 204]).toContain(res.status);
        });

        test('T3.22 — Soft-deleted record excluded from list', async () => {
            const res = await request(app).get('/api/v1/records').set('Authorization', `Bearer ${viewerToken}`);
            expect(res.body.data.find(r => r.id === seededRecordId.toString())).toBeUndefined();
        });

        test('T3.23 — Soft-deleted record returns 404 on direct GET', async () => {
            const res = await request(app).get(`/api/v1/records/${seededRecordId}`).set('Authorization', `Bearer ${viewerToken}`);
            expect(res.status).toBe(404);
        });

        test('T3.24 — VIEWER cannot delete a record', async () => {
            const res = await request(app).delete(`/api/v1/records/${createdRecordId}`).set('Authorization', `Bearer ${viewerToken}`);
            expect(res.status).toBe(403);
        });
    });
});
