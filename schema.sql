-- ---------------------------------------------------------
-- SuratSalon Hub Database Schema Definition
-- ---------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS surat_salon_db;
USE surat_salon_db;

-- ---------------------------------------------------------
-- System & Security
-- ---------------------------------------------------------

-- Users Table
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role ENUM('ADMIN', 'STYLIST', 'RECEPTIONIST') NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_locked BOOLEAN NOT NULL DEFAULT 0,
    failed_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Refresh Tokens
CREATE TABLE refresh_tokens (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Personnel
-- ---------------------------------------------------------

-- Stylists Table
CREATE TABLE stylists (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL UNIQUE,
    specialisation ENUM('Hair Stylist', 'Beautician', 'Makeup Artist', 'Spa Therapist') NOT NULL,
    commission_rate DECIMAL(5, 2) NOT NULL,
    status ENUM('Active', 'On Leave', 'Deleted') NOT NULL DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_stylist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Stylist Working Schedule
CREATE TABLE stylist_working_schedule (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stylist_id INT UNSIGNED NOT NULL,
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    is_working BOOLEAN NOT NULL DEFAULT 0,
    start_time TIME NULL,
    end_time TIME NULL,
    status TINYINT NOT NULL DEFAULT 1,
    CONSTRAINT uq_stylist_schedule UNIQUE (stylist_id, day_of_week),
    CONSTRAINT fk_schedule_stylist FOREIGN KEY (stylist_id) REFERENCES stylists(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------

-- Service Categories
CREATE TABLE service_categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    status TINYINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Services
CREATE TABLE services (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    service_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    duration_mins SMALLINT UNSIGNED NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    gender ENUM('Male', 'Female', 'Unisex') NOT NULL DEFAULT 'Unisex',
    description TEXT NULL,
    status TINYINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_service_category FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE RESTRICT
);

-- Stylist Services Mapping (Junction)
CREATE TABLE stylist_services (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stylist_id INT UNSIGNED NOT NULL,
    service_id INT UNSIGNED NOT NULL,
    status TINYINT NOT NULL DEFAULT 1,
    CONSTRAINT uq_stylist_service UNIQUE (stylist_id, service_id),
    CONSTRAINT fk_ss_stylist FOREIGN KEY (stylist_id) REFERENCES stylists(id) ON DELETE CASCADE,
    CONSTRAINT fk_ss_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
);

-- Customers
CREATE TABLE customers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NULL,
    phone VARCHAR(15) UNIQUE NOT NULL,
    gender ENUM('Male', 'Female', 'Unisex') NULL,
    date_of_birth DATE NULL,
    notes TEXT NULL,
    status TINYINT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- Core Operations
-- ---------------------------------------------------------

-- Appointments
CREATE TABLE appointments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    appointment_code VARCHAR(20) UNIQUE NOT NULL,
    customer_id INT UNSIGNED NOT NULL,
    stylist_id INT UNSIGNED NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    total_duration SMALLINT UNSIGNED NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('Scheduled', 'Completed', 'Cancelled', 'No-Show') NOT NULL DEFAULT 'Scheduled',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_appointment_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointment_stylist FOREIGN KEY (stylist_id) REFERENCES stylists(id) ON DELETE RESTRICT
);

-- Appointment Services Snapshot
CREATE TABLE appointment_services (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT UNSIGNED NOT NULL,
    service_id INT UNSIGNED NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    duration_mins SMALLINT UNSIGNED NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT 0,
    CONSTRAINT uq_appt_service UNIQUE (appointment_id, service_id),
    CONSTRAINT fk_appt_service_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    CONSTRAINT fk_appt_service_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT
);

-- Time Slots
CREATE TABLE time_slots (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    stylist_id INT UNSIGNED NOT NULL,
    appointment_id INT UNSIGNED NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status ENUM('Available', 'Booked') NOT NULL DEFAULT 'Available',
    CONSTRAINT fk_time_slot_stylist FOREIGN KEY (stylist_id) REFERENCES stylists(id) ON DELETE CASCADE,
    CONSTRAINT fk_time_slot_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

-- Payments
CREATE TABLE payments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    appointment_id INT UNSIGNED NOT NULL UNIQUE,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method ENUM('Cash', 'Card', 'UPI', 'Other') NOT NULL,
    payment_status ENUM('Pending', 'Paid', 'Refunded') NOT NULL DEFAULT 'Pending',
    transaction_ref VARCHAR(100) NULL,
    notes TEXT NULL,
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_payment_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE RESTRICT
);