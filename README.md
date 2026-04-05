# Finance Dashboard Backend

A premium, robust backend system for a finance dashboard, supporting user management, financial record CRUD operations, aggregated analytics, and strict Role-Based Access Control (RBAC).

## Features

- **Authentication**: JWT-based authentication with register, login, and profile endpoints.
- **User Management**: Admin-only capabilities to manage user roles (`VIEWER`, `ANALYST`, `ADMIN`) and account status (`ACTIVE`, `INACTIVE`).
- **Financial Records**: Full CRUD for financial data with support for filtering (type, category, date range), sorting, and search.
- **Analytics Dashboard**: 
  - Summary views (total income, expense, net balance).
  - Category-wise breakdown.
  - Time-series trends (monthly/weekly) with zero-filling for gaps.
- **Access Control**: Role-gated APIs and blocking of inactive accounts.
- **Audit Logging**: Automatic logging of all high-impact actions (creation, updates, deletions).
- **Soft Deletes**: Financial records are logically removed without data loss.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **ODM**: Mongoose
- **Auth**: JSON Web Tokens (JWT) & Bcrypt
- **Logging**: Morgan (request logging)

## Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)

### 2. Installation
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory based on `.env.example`:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/finance_dashboard
JWT_SECRET=your_jwt_secret_here
```

### 4. Seed Data
Populate the database with default users and sample financial records:
```bash
npm run seed
```
This creates:
- **Admin**: `admin@finance.dev` / `Admin@1234`
- **Analyst**: `analyst@finance.dev` / `Analyst@1234`
- **Viewer**: `viewer@finance.dev` / `Viewer@1234`

### 5. Running the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## API Documentation (Swagger UI)

The API is fully documented using Swagger UI. Once the server is running, you can access the documentation at:
**`http://localhost:3000/api/docs`**

### Using Authorized Endpoints
Endpoints with a **lock icon** require authentication. To use them:
1. Log in via `POST /api/v1/auth/login` to obtain a `token`.
2. Click the green **Authorize** button at the top of the Swagger page.
3. Paste the JWT token into the `Value` field and click **Authorize**.
4. You can now test all protected endpoints.

## Role Permissions Matrix

| Action | VIEWER | ANALYST | ADMIN |
|---|---|---|---|
| View own profile | ✅ | ✅ | ✅ |
| View records/dashboard | ✅ | ✅ | ✅ |
| View analytics (categories/trends) | ❌ | ✅ | ✅ |
| Manage users (CRUD) | ❌ | ❌ | ✅ |
| Manage records (CUD) | ❌ | ❌ | ✅ |

## Testing

Run the full test suite (Phases 1-5):
```bash
npm test
```

## Project Cleanup & Structure
The project follows a clean modular architecture:
- `src/modules`: Feature-based logic (Auth, Users, Records, Dashboard).
- `src/middleware`: Global security and error handling.
- `src/models`: Mongoose schemas and validation.
- `src/utils`: Reusable helper services (Audit, Validation).
- `tests`: Comprehensive integration tests for all implementation phases.
