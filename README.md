# Bincom Dev Center Platform

A centralized Talent Development and Operational Management ecosystem for structured learning, attendance tracking, microservice modules, and project cooperation.

## Features

- **Attendance Tracking**: Real-time meeting check-in system categorizing participants as On-Time, Late, or Absent based on strict Lagos timezone rules (WAT/GMT+1).
- **Admin Dashboard**: Comprehensive management interface for tracking meetings, users, attendance history, tracks, and levels.
- **Firebase Integration**: Firestore real-time synchronization for persistent storage of student profiles, meetings, and attendance logs.
- **Microservices & Learning Tracks**: Multi-track management for dev center programs.

## Getting Started

### Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher

### Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure your Firebase credentials in `.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

### Installation

```bash
npm install
```

### Running Locally

```bash
npm run dev
```

The application will start on `http://localhost:3000`.

### Production Build

To test or generate a production bundle:

```bash
npm run build
```

The build output will be stored in the `dist/` directory.

---

## Deployment to GitHub

1. Initialize a Git repository (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Bincom Dev Center Platform"
   ```
2. Link your GitHub repository and push:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git
   git push -u origin main
   ```
