const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
require('dotenv').config();

// Add a dummy protected route for T2.12
const { requireRole } = require('../src/middleware/role.middleware');
const authMiddleware = require('../src/middleware/auth.middleware');

describe('Phase 2: Authentication & User Session', () => {
    let adminToken;
    let viewerToken;

    beforeAll(async () => {
        // Use a test DB
        const url = process.env.MONGODB_URI + '_test';
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
        }
        await mongoose.connect(url);
        await User.deleteMany({});
        
        // Seed an admin user directly to test login
        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash('Admin@1234', 10);
        await User.create({
            name: 'Admin User',
            email: 'admin@finance.dev',
            password: hashedPassword,
            role: 'ADMIN',
            status: 'ACTIVE'
        });
    });

    afterAll(async () => {
        await User.deleteMany({});
        await mongoose.connection.close();
    });

    test('T2.1 — Successful registration', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Test User', email: 'test@example.com', password: 'Pass@1234' });

        expect(res.status).toBe(201);
        expect(res.body.role).toBe('VIEWER');
        expect(res.body.password).toBeUndefined();
    });

    test('T2.2 — Duplicate email on register', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'Test User 2', email: 'test@example.com', password: 'Pass@1234' });

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('CONFLICT');
    });

    test('T2.3 — Register with missing fields', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ email: 'incomplete@example.com' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        const fieldErrors = res.body.error.details.map(d => d.field);
        expect(fieldErrors).toContain('name');
        expect(fieldErrors).toContain('password');
    });

    test('T2.4 — Register with invalid email', async () => {
        const res = await request(app)
            .post('/api/v1/auth/register')
            .send({ name: 'X', email: 'not-an-email', password: 'Pass@1234' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
        const fieldErrors = res.body.error.details.map(d => d.field);
        expect(fieldErrors).toContain('email');
    });

    test('T2.5 — Successful login', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'admin@finance.dev', password: 'Admin@1234' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
        expect(res.body.user).toBeDefined();
        expect(res.body.user.role).toBe('ADMIN');

        adminToken = res.body.token; // Save for later
    });

    test('T2.6 — Login with wrong password', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'admin@finance.dev', password: 'wrongpassword' });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('T2.7 — Login with non-existent email', async () => {
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'ghost@example.com', password: 'Pass@1234' });

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED'); // Do not leak existence
    });

    test('T2.8 — GET /auth/me with valid token', async () => {
        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.email).toBe('admin@finance.dev');
    });

    test('T2.9 — GET /auth/me with no token', async () => {
        const res = await request(app)
            .get('/api/v1/auth/me');

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('T2.10 — GET /auth/me with malformed token', async () => {
        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', 'Bearer invalidtoken123');

        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    test('T2.11 — INACTIVE user is blocked', async () => {
        // Set user INACTIVE
        await User.updateOne({ email: 'admin@finance.dev' }, { status: 'INACTIVE' });
        
        const res = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
        
        // Restore status
        await User.updateOne({ email: 'admin@finance.dev' }, { status: 'ACTIVE' });
    });

    test('T2.12 — Role guard: VIEWER blocked from ADMIN route', async () => {
        // Create an isolated express app for testing role guards to avoid 404 handler conflicts
        const express = require('express');
        const testingApp = express();
        testingApp.use(express.json());
        testingApp.get('/api/v1/users-dummy', authMiddleware, requireRole('ADMIN'), (req, res) => res.status(200).json({ ok: true }));

        // Login as viewer to get token
        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({ email: 'test@example.com', password: 'Pass@1234' }); 
            
        viewerToken = loginRes.body.token;
        
        const res = await request(testingApp)
            .get('/api/v1/users-dummy') // Hits the dummy block
            .set('Authorization', `Bearer ${viewerToken}`);

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('FORBIDDEN');
    });
});
