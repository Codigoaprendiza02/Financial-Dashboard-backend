const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const FinancialRecord = require('../src/models/record.model');
const AuditLog = require('../src/models/auditlog.model');
require('dotenv').config();

/**
 * End-to-End Integration Test: The "Full Journey"
 * 
 * This test simulates a complete real-world scenario:
 * 1. Admin setup
 * 2. User registration and promotion (RBAC)
 * 3. Records management (CRUD, soft-delete, precision)
 * 4. Dashboard & Analytics verification
 * 5. Audit trail verification
 */
describe('System End-to-End Inspection', () => {
    let adminToken, userToken;
    let userId, recordId;

    beforeAll(async () => {
        // Connect to test DB
        const url = process.env.MONGODB_URI + '_full_system_test';
        if (mongoose.connection.readyState === 1) await mongoose.disconnect();
        await mongoose.connect(url);
        
        // Deep clean
        await User.deleteMany({});
        await FinancialRecord.deleteMany({});
        await AuditLog.deleteMany({});

        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('Admin@1234', 10);
        
        // 1. Create Initial Admin
        await User.create({
            name: 'System Administrator',
            email: 'admin@system.dev',
            password: hashedPassword,
            role: 'ADMIN'
        });

        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'admin@system.dev', password: 'Admin@1234' });
        adminToken = loginRes.body.token;
    });

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test('Full System Scenario Flow', async () => {
        console.log('--- Step 1: User Registration & Promotion ---');
        
        // Register a new user (defaults to VIEWER)
        const regRes = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'John Doe', email: 'john@example.com', password: 'Password@123' });
        expect(regRes.status).toBe(201);
        userId = regRes.body.id;

        // Login as John (VIEWER)
        const johnLoginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'john@example.com', password: 'Password@123' });
        userToken = johnLoginRes.body.token;

        // John tries to create a record (Blocked - 403)
        const failRecord = await request(app)
            .post('/api/v1/records')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ amount: 100, type: 'INCOME', category: 'Gift', date: '2025-01-01' });
        expect(failRecord.status).toBe(403);

        // Admin promotes John to ANALYST
        const promoteRes = await request(app)
            .patch(`/api/v1/users/${userId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ role: 'ANALYST' });
        expect(promoteRes.status).toBe(200);
        expect(promoteRes.body.role).toBe('ANALYST');

        // Verify Audit Log for promotion
        const auditPromote = await AuditLog.findOne({ action: 'UPDATE_USER', targetId: userId });
        expect(auditPromote).toBeDefined();

        console.log('--- Step 2: Financial Data Management ---');

        // Admin creates records
        const r1 = await request(app).post('/api/v1/records').set('Authorization', `Bearer ${adminToken}`)
            .send({ amount: 5000.758, type: 'INCOME', category: 'Salary', date: '2025-10-01', notes: 'Monthly salary' });
        expect(r1.body.amount).toBe(5000.76); // Precision check
        recordId = r1.body.id;

        await request(app).post('/api/v1/records').set('Authorization', `Bearer ${adminToken}`)
            .send({ amount: 1200.00, type: 'EXPENSE', category: 'Rent', date: '2025-10-05' });

        await request(app).post('/api/v1/records').set('Authorization', `Bearer ${adminToken}`)
            .send({ amount: 300.50, type: 'EXPENSE', category: 'Food', date: '2025-10-10' });

        // Admin soft-deletes the Food record
        const foodRec = await FinancialRecord.findOne({ category: 'Food' });
        await request(app).delete(`/api/v1/records/${foodRec._id}`).set('Authorization', `Bearer ${adminToken}`);

        // Verify Audit Log for record creation and deletion
        const auditCreate = await AuditLog.findOne({ action: 'CREATE_RECORD', targetId: recordId });
        const auditDelete = await AuditLog.findOne({ action: 'DELETE_RECORD', targetId: foodRec._id });
        expect(auditCreate).toBeDefined();
        expect(auditDelete).toBeDefined();

        console.log('--- Step 3: Dashboard & Search Verification ---');

        // Analyst (John) checks summary
        const summaryRes = await request(app).get('/api/v1/dashboard/summary?from=2025-10-01&to=2025-10-31')
            .set('Authorization', `Bearer ${userToken}`);
        expect(summaryRes.status).toBe(200);
        expect(summaryRes.body.total_income).toBe(5000.76);
        expect(summaryRes.body.total_expenses).toBe(1200.00); // Food (300.50) is deleted

        // Analyst checks trends
        const trendsRes = await request(app).get('/api/v1/dashboard/trends?granularity=monthly&from=2025-10-01&to=2025-10-31')
            .set('Authorization', `Bearer ${userToken}`);
        expect(trendsRes.body.data.find(d => d.period === '2025-10').net).toBe(3800.76);

        // Admin searches for records
        const searchRes = await request(app).get('/api/v1/records?search=Salary').set('Authorization', `Bearer ${adminToken}`);
        expect(searchRes.body.data.length).toBe(1);
        expect(searchRes.body.total).toBe(1);

        console.log('--- Step 4: System Integrity / Errors ---');

        // Invalid date range (400)
        const badDate = await request(app).get('/api/v1/dashboard/summary?from=2025-12-01&to=2025-01-01').set('Authorization', `Bearer ${adminToken}`);
        expect(badDate.status).toBe(400);
        expect(badDate.body.error.code).toBe('VALIDATION_ERROR');

        // Unauthenticated access
        const noAuth = await request(app).get('/api/v1/users');
        expect(noAuth.status).toBe(401);
    }, 30000); // 30s timeout
});
