import dotenv from 'dotenv'
import mysql from 'mysql2/promise'

dotenv.config()

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
})

export async function connectDatabase() {
  const connection = await pool.getConnection()
  try {
    await connection.ping()
  } finally {
    connection.release()
  }
  await ensureTables()
}

export async function closeDatabase() {
  await pool.end()
}

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      mobile VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin','collector','accountant','member') DEFAULT 'member',
      address TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chit_groups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_name VARCHAR(150) NOT NULL,
      total_members INT NOT NULL,
      monthly_amount DECIMAL(10,2) NOT NULL,
      duration_months INT NOT NULL,
      start_date DATE NOT NULL,
      status ENUM('active','inactive','completed') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_code VARCHAR(50) UNIQUE,
      full_name VARCHAR(150) NOT NULL,
      mobile VARCHAR(20) NOT NULL UNIQUE,
      email VARCHAR(150) NULL,
      address TEXT NULL,
      aadhaar_number VARCHAR(20) NULL,
      photo VARCHAR(255) NULL,
      group_id INT NULL,
      joining_date DATE NULL,
      status ENUM('active','inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (group_id),
      CONSTRAINT members_group_fk FOREIGN KEY (group_id) REFERENCES chit_groups(id) ON DELETE SET NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS collections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      group_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      payment_month VARCHAR(50) NULL,
      payment_date DATE NULL,
      payment_mode ENUM('cash','gpay','phonepe','bank_transfer','upi','bank') NULL,
      payment_status ENUM('paid','pending','partial') DEFAULT 'paid',
      remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (member_id),
      INDEX (group_id),
      CONSTRAINT collections_member_fk FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      CONSTRAINT collections_group_fk FOREIGN KEY (group_id) REFERENCES chit_groups(id) ON DELETE CASCADE
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receipt_number VARCHAR(100) UNIQUE,
      collection_id INT NULL,
      generated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (collection_id),
      CONSTRAINT receipts_collection_fk FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auctions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      auction_month VARCHAR(50) NULL,
      winner_member_id INT NULL,
      bid_amount DECIMAL(10,2) NULL,
      prize_amount DECIMAL(10,2) NULL,
      auction_date DATE NULL,
      remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (group_id),
      INDEX (winner_member_id),
      CONSTRAINT auctions_group_fk FOREIGN KEY (group_id) REFERENCES chit_groups(id) ON DELETE CASCADE,
      CONSTRAINT auctions_winner_fk FOREIGN KEY (winner_member_id) REFERENCES members(id) ON DELETE SET NULL
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entry_type ENUM('credit','debit') NOT NULL,
      title VARCHAR(150) NULL,
      amount DECIMAL(10,2) NULL,
      entry_date DATE NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(150) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'General',
      amount DECIMAL(10,2) NOT NULL,
      expense_date DATE NULL,
      payment_mode ENUM('cash','upi','bank','gpay','phonepe','bank_transfer') NULL,
      remarks TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NULL,
      message TEXT NULL,
      notification_type ENUM('sms','email','whatsapp','push') NULL,
      sent_to VARCHAR(150) NULL,
      status ENUM('pending','sent','failed') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
}
