# 🚑 ASMS - Ambulance Service Management System

A production-ready, real-time ambulance booking and management platform designed to connect patients, drivers, and administrators seamlessly. Built with **React (Vite + TypeScript + Tailwind CSS)** and a robust **Node.js (Express + Socket.IO + MongoDB)** backend.

---

## 🌟 Key Capabilities

### 🏥 Patient Portal
* **Emergency SOS Trigger**: One-click instant ICU ambulance request for emergency situations.
* **Flexible Bookings**: Choose from multiple vehicle tiers (Normal, ICU, Cardiac, Dead Body Van) based on medical urgency.
* **Live Fare Estimator**: Instant dynamic fare calculations based on precise distance estimates.
* **Real-time Notifications**: Direct visual updates and alerts on ride request state transitions (Requested ➔ Accepted ➔ En Route ➔ Arrived ➔ Dropped).
* **Interactive Mapping**: Leaflet-powered maps showing ambulance allocation and tracking.

### 🚗 Driver Companion
* **Online/Offline Toggle**: Real-time status update to signify availability to the system.
* **Booking Requests Queue**: Seamlessly accept or decline incoming trip assignments.
* **Live GPS Tracking**: Broadcasts precise geographical coordinates every 5 seconds to patients and admins.
* **Background Tracking Continuity**: Utilizes the browser's Visibility API to continue broadcasting driver coordinates even when the screen is locked or the browser is minimized.
* **Earnings Analytics**: Dynamic dashboard highlighting daily, weekly, and total ride statistics and payout tracking.

### 👨‍💼 Administrative Control Center
* **Operational Overview Dashboard**: High-level telemetry showing active bookings, online drivers, and total completed trips.
* **Real-time Map Monitor**: A central interactive map showing live positions of all active drivers in real time.
* **Driver Onboarding & Auditing**: Review submitted credentials (license, registration) and approve/disable driver accounts.
* **Revenue & Payout Analytics**: Track total collections, manage Razorpay payouts, and trigger block schedules for inactive accounts.

---

## ⚙️ Technical Architecture & Features

### 1. Real-Time Tracking (Socket.IO + Leaflet)
* Dual-way socket communication to broadcast driver latitude/longitude updates.
* Automatically records GeoJSON Point trails in MongoDB `locationhistories` for travel distance calculation and route verification.

### 2. Background Location Continuity
* Avoids battery drain while guaranteeing dispatcher visibility.
* Transitions between **Foreground Mode** (5s high-frequency updates) and **Background Mode** (15s updates) using the Page Visibility API.

### 3. Payment Gateway Integration
* Razorpay API integration for secure online payments.
* Automatic generation of invoices and dynamic transaction status tracking.

### 4. Advanced Security Suite
* Role-Based Access Control (RBAC) enforced via JsonWebToken (JWT).
* Protection against MongoDB injections using `express-mongo-sanitize`.
* Security HTTP headers loaded via `helmet` and API protection with `express-rate-limit`.

---

## 📊 Ambulance Fleet & Pricing Model

| Ambulance Type | Base Fare | Per KM Rate | Primary Use Case |
| :--- | :---: | :---: | :--- |
| **Normal** | ₹200 | ₹15/km | General non-emergency hospital transport |
| **ICU** | ₹500 | ₹30/km | Critical care patients requiring ventilator/oxygen support |
| **Cardiac** | ₹600 | ₹35/km | Cardiac emergencies and specialist machinery |
| **Dead Body Van** | ₹300 | ₹20/km | Safe and respectful deceased transportation |

---

## 🛠️ Technology Stack

* **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Leaflet Maps, Socket.IO Client, Lucide Icons, SheetJS (XLSX reports).
* **Backend**: Node.js, Express.js, Socket.IO, MongoDB (Mongoose ODM), Razorpay SDK, Nodemailer, Node-cron (scheduled payouts).
* **Security**: Helmet, Express Mongo Sanitize, Express Rate Limit, bcryptjs, JSON Web Tokens.

---

## 🗂️ Project Directory Structure

```
GR-15Ambulance_Service_Management_System/
├── ambulancesystem/
│   ├── database/                  # SQL/NoSQL Database seed scripts
│   ├── backend/
│   │   └── ambulance-backend/     # Node.js + Express API server
│   │       ├── config/            # DB & connection setups
│   │       ├── middleware/        # JWT auth, Rate Limiter
│   │       ├── models/            # Mongoose Schemas (Patient, Driver, Booking, etc.)
│   │       ├── routes/            # Express REST Router definitions
│   │       ├── utils/             # Payout schedulers, mail dispatchers
│   │       └── server.js          # Express entrypoint & Socket.IO server
│   └── frontend/
│       ├── src/                   # React + TypeScript source files
│       │   ├── components/        # MapView, auth and shared components
│       │   ├── context/           # Global AuthContext & SocketContext
│       │   ├── pages/             # Dashboards (Patient, Driver, Admin)
│       │   └── main.tsx           # React bootstrap entrypoint
│       └── package.json
```

---

## 📂 Environment Variables Config

Create a `.env` file in `ambulancesystem/backend/ambulance-backend/` containing:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database Connection
MONGO_URI=mongodb://127.0.0.1:27017/ambulance-booking

# JWT Authentication Secrets
JWT_SECRET=your_jwt_secret_key_here
JWT_PREVIOUS_SECRET=

# Nodemailer SMTP Configuration
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_specific_password

# Razorpay Integration Credentials
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Security Policies
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## 🚀 Setup & Execution Guide

### 1. Prerequisites
Ensure you have **Node.js** (v16+) and **MongoDB** installed and running on your system.

### 2. Backend Installation & Seed
```bash
# Navigate to the backend directory
cd ambulancesystem/backend/ambulance-backend

# Install package dependencies
npm install

# Seed the database (creates admin, driver, and patient testing accounts)
npm run seed  # runs seeder.js
# Or seed Surat hospital datasets:
node seed-surat-hospitals.js

# Start the server (Dev Mode with nodemon)
npm run dev
```
The server will boot up at `http://localhost:5000`.

### 3. Frontend Installation
```bash
# Open a new terminal and navigate to the frontend directory
cd ambulancesystem/frontend

# Install front-end dependencies
npm install

# Run the Vite development server
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🔑 Test Credentials

To start testing the platform immediately, use these seeded accounts:

### 👨‍💼 Admin Panel
* **Email**: `admin@ambulance.com`
* **Password**: `admin123`

### 🏥 Patient Panel
* **Email**: `patient@test.com`
* **Password**: `admin123`
* *Or register a new patient via the frontend panel.*

### 🚗 Driver Panel
* **Email**: `driver@test.com`
* **Password**: `admin123`
* *Or register a new driver and approve them using the admin dashboard.*

---

## 🧭 Live GPS Testing Utility
You can test the real-time location stream and watch socket traffic coordinates live using the internal testing page:
👉 **URL**: `http://localhost:5000/test-gps` (Ensure the backend server is running).
