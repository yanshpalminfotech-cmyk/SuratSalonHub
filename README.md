<p align="center">
  <h1 align="center">Surat Salon Hub</h1>
</p>

<p align="center">
  A premium backend system for managing salon operations, including appointments, stylists, services, and customers.
</p>

## 📋 Table of Contents
- [Description](#description)
- [Requirements](#requirements)
- [Setup & Installation](#setup--installation)
- [Database Seeding](#database-seeding)
- [Security & Rate Limiting](#security--rate-limiting)
- [Technical Architecture](#technical-architecture)
  - [Multi-Service Duration Calculation](#1-multi-service-duration-calculation)
  - [Concurrent Stylist Slot Booking](#2-concurrent-stylist-slot-booking)
  - [Atomic Code Generation](#3-atomic-code-generation)
- [Running the Project](#running-the-project)
- [Testing](#testing)

---

## 📖 Description

Surat Salon Hub is a comprehensive API framework built with **NestJS**. it enables seamless salon management by handling complex scheduling logic, service categorization, staff availability, and payment processing.

## 🛠️ Requirements

- **Node.js**: v18 or higher
- **MySQL**: Database for persistent storage
- **Redis**: Used for session management
- **npm/yarn**: Package manager

## 🚀 Setup & Installation

1. **Install Dependencies**
   ```bash
   $ npm install
   ```

2. **Configure Environment**
   Create a `.env` file in the root directory based on `.env.example`:
   ```env
   # Server
   PORT=3000

   # MySQL
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=salon_hub

   # Redis
   REDIS_HOST=localhost
   REDIS_PORT=6379
   
   # JWT
   JWT_ACCESS_SECRET=your_secret
   JWT_ACCESS_EXPIRES_IN=1h

   THROTTLER_TTL = 
   THROTTLER_LIMIT = 
   ```

## 🏗️ Database Seeding

The project features an automated seeding process to populate the system with essential reference data (Admin, Stylists, Services) and sample records.

```bash
$ npm run seed
```
> [!WARNING]
> This command will truncate existing tables before seeding. Use with caution in non-development environments.

---

## 🛡️ Security & Rate Limiting

The API implements robust protection using `@nestjs/throttler`:
- **Throttling**: Default limit of 10 requests per minute per IP.
- **Data Integrity**: All critical operations are wrapped in SQL transactions.

---

## 🏗️ Technical Architecture

### 1. Multi-Service Duration Calculation
When booking an appointment with multiple services, the system dynamically calculates the total time required:

- **Calculation Logic**: The system iterates through all selected services and sums their `durationMins`.
  ```typescript
  const totalDuration = services.reduce((sum, s) => sum + Number(s.durationMins), 0);
  ```
- **Time Block Mapping**: This total duration is then mapped to the appropriate number of 15-minute `TimeSlot` entities. For instance, a 45-minute service sequence will block **3 consecutive slots**.
- **Dynamic End-Time**: The `endTime` of the appointment is automatically set based on the `startTime` plus the calculated `totalDuration`.

### 2. Concurrent Stylist Slot Booking
The system prevents "double-booking" through multi-level concurrency control:

- **Atomic Transactions**: Booking, slot updates, and payment record creation happen inside a single atomic transaction.
- **Pessimistic Locking**: The system uses `SELECT ... FOR UPDATE` (Pessimistic Write Lock) on the specific `TimeSlot` rows being booked. This prevents any other concurrent request from locking or modifying the same slots until the first transaction is complete.
- **Availability Re-verification**: Inside the lock, the system re-confirms that every single 15-minute slot in the requested block is still `AVAILABLE`.

### 3. Atomic Code Generation
Customer and Appointment codes (e.g., `CUST-2026-001`, `APT-2026-001`) are generated with strict collision prevention:

- **Row-Level Locking**: When generating a new code, the system performs a count of existing records for the current year while holding a **Pessimistic Write Lock**.
- **Sequential Integrity**: This ensure that no two transactions calculate the same sequence number, even if they hit the database at the exact same time.

---

## 🚦 Running the Project

```bash
# Development
$ npm run start:dev

# Production Build
$ npm run build
$ npm run start:prod
```

## 🧪 Testing

```bash
# Unit Tests
$ npm run test

# End-to-End Tests
$ npm run test:e2e
```

## Database

```bash
link : https://dbdiagram.io/d/SuratSalon-69b3a5be84de9dc38012fa5d
````

---

## 📄 License
Surat Salon Hub is [UNLICENSED](LICENSE).
