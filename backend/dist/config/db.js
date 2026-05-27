"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.connectDatabase = connectDatabase;
exports.closeDatabase = closeDatabase;
const dotenv_1 = __importDefault(require("dotenv"));
const promise_1 = __importDefault(require("mysql2/promise"));
dotenv_1.default.config();
exports.pool = promise_1.default.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
async function connectDatabase() {
    const connection = await exports.pool.getConnection();
    try {
        await connection.ping();
    }
    finally {
        connection.release();
    }
    await ensureTables();
}
async function closeDatabase() {
    await exports.pool.end();
}
async function ensureTables() {
    await exports.pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      mobile VARCHAR(20) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin','member') DEFAULT 'member',
      address TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
    await exports.pool.query(`UPDATE users SET role = 'admin' WHERE role NOT IN ('admin', 'member')`);
    await exports.pool.query(`ALTER TABLE users MODIFY role ENUM('admin','member') DEFAULT 'member'`);
    await exports.pool.query(`
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
  `);
    await exports.pool.query(`
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
  `);
    await exports.pool.query(`
    CREATE TABLE IF NOT EXISTS member_chits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member_id INT NOT NULL,
      chit_group_id INT NOT NULL,
      join_date DATE NULL,
      status ENUM('active','completed','inactive') DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_member_chit (member_id, chit_group_id),
      INDEX (member_id),
      INDEX (chit_group_id),
      CONSTRAINT member_chits_member_fk FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
      CONSTRAINT member_chits_group_fk FOREIGN KEY (chit_group_id) REFERENCES chit_groups(id) ON DELETE CASCADE
    )
  `);
    await exports.pool.query(`
    INSERT INTO members (member_code, full_name, email, mobile, address, status, joining_date)
    SELECT CONCAT('MEM-', LPAD(u.id, 5, '0')), u.full_name, u.email, u.mobile, u.address, 'active', CURDATE()
    FROM users u
    LEFT JOIN members m ON m.mobile = u.mobile OR m.email = u.email
    WHERE u.role = 'member' AND m.id IS NULL
  `);
    await exports.pool.query(`
    INSERT IGNORE INTO member_chits (member_id, chit_group_id, join_date, status)
    SELECT id, group_id, COALESCE(joining_date, CURDATE()), status
    FROM members
    WHERE group_id IS NOT NULL
  `);
    await exports.pool.query(`
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
  `);
    await exports.pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      receipt_number VARCHAR(100) UNIQUE,
      collection_id INT NULL,
      generated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX (collection_id),
      CONSTRAINT receipts_collection_fk FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    )
  `);
    await exports.pool.query(`
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
  `);
    await exports.pool.query(`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entry_type ENUM('credit','debit') NOT NULL,
      title VARCHAR(150) NULL,
      amount DECIMAL(10,2) NULL,
      entry_date DATE NULL,
      description TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
    await exports.pool.query(`
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
  `);
    await exports.pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      member_id INT NULL,
      title VARCHAR(200) NULL,
      message TEXT NULL,
      notification_type ENUM('sms','email','whatsapp','push') NULL,
      sent_to VARCHAR(150) NULL,
      status ENUM('pending','sent','failed') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX notifications_user_id_idx (user_id),
      INDEX notifications_member_id_idx (member_id)
    )
  `);
    await ensureColumn('notifications', 'user_id', 'user_id INT NULL');
    await ensureColumn('notifications', 'member_id', 'member_id INT NULL');
    await ensureIndex('notifications', 'notifications_user_id_idx', 'user_id');
    await ensureIndex('notifications', 'notifications_member_id_idx', 'member_id');
    await exports.pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      role VARCHAR(30) NULL,
      action VARCHAR(80) NOT NULL,
      description TEXT NULL,
      entity_type VARCHAR(80) NULL,
      entity_id INT NULL,
      ip_address VARCHAR(80) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX activity_logs_user_id_idx (user_id),
      INDEX activity_logs_action_idx (action),
      INDEX activity_logs_created_at_idx (created_at)
    )
  `);
}
async function ensureColumn(tableName, columnName, definition) {
    const [rows] = await exports.pool.query(`SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [tableName, columnName]);
    if (!Number(rows[0]?.total || 0)) {
        await exports.pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${definition}`);
    }
}
async function ensureIndex(tableName, indexName, columnName) {
    const [rows] = await exports.pool.query(`SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`, [tableName, indexName]);
    if (!Number(rows[0]?.total || 0)) {
        await exports.pool.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} (${columnName})`);
    }
}
