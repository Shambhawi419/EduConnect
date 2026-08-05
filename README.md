# EduConnect

Full-stack web app for college students: a doubt-resolution chatbot, a PDF-to-quiz
generator, and account security via MFA + role-based access control (RBAC).

Stack: React (Vite) + Node.js/Express + MongoDB, OpenAI for the chatbot and quiz
generation.

## Structure

- `backend/` — Express API (auth, MFA, RBAC, chatbot, quiz generation)
- `frontend/` — React app (Vite)

## Setup

### 1. MongoDB

You need a MongoDB instance. Either run one locally (`mongod`) or point
`backend/.env`'s `MONGODB_URI` at a hosted cluster (e.g. MongoDB Atlas).

### 2. Backend

```
cd backend
npm install
npm run dev
```

Runs on http://localhost:5000. Edit `backend/.env` to change the port, JWT
secret, Mongo URI, or OpenAI key.

### 3. Frontend

```
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173 and talks to the API at the URL in
`frontend/.env` (`VITE_API_BASE`).

## Features

- **Auth**: register/login with bcrypt-hashed passwords and JWTs.
- **MFA**: TOTP-based two-factor auth (Google Authenticator/Authy compatible),
  set up from the Account page — scans a QR code, confirms with a 6-digit code.
- **RBAC**: `student` and `admin` roles; admin-only routes are enforced both
  server-side (`middleware/rbac.js`) and hidden client-side in the nav.
- **Chatbot**: doubt-resolution assistant backed by OpenAI's chat API.
- **PDF to quiz**: upload a PDF, the server extracts text and asks OpenAI to
  generate a multiple-choice quiz, which is then taken interactively in the UI.
