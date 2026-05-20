const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { seedParameters } = require("./site-store");

function openDatabase(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  seedParameters(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      service_price INTEGER NOT NULL,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      client_address TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      admin_notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_active_slot
      ON bookings(date, time)
      WHERE status IN ('pending', 'confirmed');

    CREATE INDEX IF NOT EXISTS idx_bookings_date_status
      ON bookings(date, status);

    CREATE TABLE IF NOT EXISTS waitlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT,
      service_name TEXT,
      service_price INTEGER,
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      preferred_date TEXT,
      period TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_waitlist_status_created
      ON waitlist(status, created_at);

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      image TEXT NOT NULL,
      application_price INTEGER NOT NULL DEFAULT 0,
      maintenance_price INTEGER,
      price_text TEXT NOT NULL,
      maintenance_label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      duration_minutes INTEGER NOT NULL DEFAULT 120,
      featured INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_services_public
      ON services(active, sort_order, name);

    CREATE TABLE IF NOT EXISTS feed_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      image TEXT,
      cta_label TEXT,
      cta_url TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_feed_posts_public
      ON feed_posts(active, featured, sort_order, created_at);

    CREATE TABLE IF NOT EXISTS business_hours (
      day_of_week INTEGER PRIMARY KEY,
      is_open INTEGER NOT NULL DEFAULT 0,
      times_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = {
  openDatabase
};
