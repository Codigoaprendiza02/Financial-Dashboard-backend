const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const FinancialRecord = require('../src/models/record.model');
const AuditLog = require('../src/models/auditlog.model');
require('dotenv').config();

describe('Phase 5: Polish & Optional Enhancements', () => {
    let adminToken;
    let adminUser;

    beforeAll(async () => {
        const url = process.env.MONGODB_URI + '_test';
        if (mongoose.connection.readyState === 1) await mongoose.disconnect();
        await mongoose.connect(url);
        await User.deleteMany({});
        await FinancialRecord.deleteMany({});
        await AuditLog.deleteMany({});

        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('Pass@1234', 10);
        
        adminUser = await User.create({ name: 'Admin', email: 'admin@finance.dev', password: hashedPassword, role: 'ADMIN' });
        
        const res = await request(app).post('/api/v1/auth/login').send({ email: 'admin@finance.dev', password: 'Pass@1234' });
        adminToken = res.body.token;

        // Seed some records
        await FinancialRecord.create([
            { amount: 100, type: 'INCOME', category: 'Coffee Sale', date: '2025-01-01', createdBy: adminUser._id, notes: 'Special blend' },
            { amount: 200, type: 'EXPENSE', category: 'Rent', date: '2025-01-02', createdBy: adminUser._id, notes: 'Office space' },
            { amount: 300, type: 'INCOME', category: 'Consulting', date: '2025-01-03', createdBy: adminUser._id, notes: 'Python project' }
        ]);
    });

    afterAll(async () => {
        await User.deleteMany({});
        await FinancialRecord.deleteMany({});
        await AuditLog.deleteMany({});
        await mongoose.connection.close();
    });

    test('Pagination Metadata exists on list records', async () => {
        const res = await request(app).get('/api/v1/records?page=1&limit=2').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.total).toBe(3);
        expect(res.body.page).toBe(1);
        expect(res.body.limit).toBe(2);
        expect(res.body.totalPages).toBe(2);
    });

    test('Search records by category or notes', async () => {
        // Search by category
        const res1 = await request(app).get('/api/v1/records?search=Coffee').set('Authorization', `Bearer ${adminToken}`);
        expect(res1.body.data.length).toBe(1);
        expect(res1.body.data[0].category).toBe('Coffee Sale');

        // Search by notes
        const res2 = await request(app).get('/api/v1/records?search=Python').set('Authorization', `Bearer ${adminToken}`);
        expect(res2.body.data.length).toBe(1);
        expect(res2.body.data[0].notes).toBe('Python project');
    });

    test('Audit Log is created on record creation', async () => {
        const countBefore = await AuditLog.countDocuments({ action: 'CREATE_RECORD' });
        
        await request(app)
            .post('/api/v1/records')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ amount: 50.555, type: 'EXPENSE', category: 'Test Audit', date: '2025-01-04' });

        const countAfter = await AuditLog.countDocuments({ action: 'CREATE_RECORD' });
        expect(countAfter).toBe(countBefore + 1);

        const latest = await FinancialRecord.findOne({ category: 'Test Audit' });
        expect(latest.amount).toBe(50.56); // Verify rounding
    });

    test('Audit Log is created on user update', async () => {
        const countBefore = await AuditLog.countDocuments({ action: 'UPDATE_USER' });
        
        await request(app)
            .patch(`/api/v1/users/${adminUser._id}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'Updated Admin' });

        const countAfter = await AuditLog.countDocuments({ action: 'UPDATE_USER' });
        expect(countAfter).toBe(countBefore + 1);
    });

    test('Pagination Metadata exists on list users', async () => {
        const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.total).toBeGreaterThanOrEqual(1);
    });
});
