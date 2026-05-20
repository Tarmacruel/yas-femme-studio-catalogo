const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_SERVICES,
  DEFAULT_SETTINGS
} = require("./defaults");

function seedParameters(db) {
  seedServices(db);
  seedBusinessHours(db);
  seedSettings(db);
}

function seedServices(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO services (
      id, name, image, application_price, maintenance_price, price_text,
      maintenance_label, description, duration_minutes, featured, active,
      sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  for (const service of DEFAULT_SERVICES) {
    insert.run(
      service.id,
      service.name,
      service.image,
      service.applicationPrice,
      service.maintenancePrice,
      service.priceText,
      service.maintenanceLabel,
      service.description,
      service.durationMinutes,
      service.featured ? 1 : 0,
      service.active ? 1 : 0,
      service.sortOrder
    );
  }
}

function seedBusinessHours(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO business_hours (
      day_of_week, is_open, times_json, created_at, updated_at
    ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  for (const day of DEFAULT_BUSINESS_HOURS) {
    insert.run(day.dayOfWeek, day.isOpen ? 1 : 0, JSON.stringify(day.times));
  }
}

function seedSettings(db) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO site_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `);

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    insert.run(key, JSON.stringify(value));
  }
}

function getSettings(db) {
  const rows = db.prepare("SELECT key, value FROM site_settings").all();
  const settings = structuredClone(DEFAULT_SETTINGS);

  for (const row of rows) {
    try {
      settings[row.key] = { ...(settings[row.key] || {}), ...JSON.parse(row.value) };
    } catch {
      settings[row.key] = settings[row.key] || {};
    }
  }

  return settings;
}

function updateSettings(db, patch) {
  const current = getSettings(db);
  const next = {
    site: { ...current.site, ...(patch.site || {}) },
    hero: { ...current.hero, ...(patch.hero || {}) },
    contact: { ...current.contact, ...(patch.contact || {}) },
    location: { ...current.location, ...(patch.location || {}) },
    payments: normalizePayments({ ...current.payments, ...(patch.payments || {}) })
  };

  const update = db.prepare(`
    INSERT INTO site_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `);

  for (const [key, value] of Object.entries(next)) {
    update.run(key, JSON.stringify(value));
  }

  return getSettings(db);
}

function normalizePayments(payments) {
  return {
    pix: Boolean(payments.pix),
    cash: Boolean(payments.cash),
    debit: normalizeList(payments.debit),
    credit: normalizeList(payments.credit),
    vouchers: normalizeList(payments.vouchers)
  };
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function getServices(db, { includeInactive = false } = {}) {
  const rows = db.prepare(`
    SELECT * FROM services
    WHERE (? = 1 OR active = 1)
    ORDER BY sort_order ASC, name ASC
  `).all(includeInactive ? 1 : 0);
  return rows.map(mapService);
}

function getServiceById(db, id, { includeInactive = false } = {}) {
  const row = db.prepare(`
    SELECT * FROM services
    WHERE id = ? AND (? = 1 OR active = 1)
  `).get(id, includeInactive ? 1 : 0);
  return row ? mapService(row) : null;
}

function createService(db, input) {
  const id = uniqueServiceId(db, input.id || slugify(input.name || "servico"));
  const service = normalizeServiceInput({ ...input, id });
  db.prepare(`
    INSERT INTO services (
      id, name, image, application_price, maintenance_price, price_text,
      maintenance_label, description, duration_minutes, featured, active,
      sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    service.id,
    service.name,
    service.image,
    service.applicationPrice,
    service.maintenancePrice,
    service.priceText,
    service.maintenanceLabel,
    service.description,
    service.durationMinutes,
    service.featured ? 1 : 0,
    service.active ? 1 : 0,
    service.sortOrder
  );
  return getServiceById(db, id, { includeInactive: true });
}

function updateService(db, id, patch) {
  const existing = getServiceById(db, id, { includeInactive: true });
  if (!existing) return null;
  const service = normalizeServiceInput({ ...existing, ...patch, id });
  db.prepare(`
    UPDATE services
    SET name = ?, image = ?, application_price = ?, maintenance_price = ?,
        price_text = ?, maintenance_label = ?, description = ?,
        duration_minutes = ?, featured = ?, active = ?, sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    service.name,
    service.image,
    service.applicationPrice,
    service.maintenancePrice,
    service.priceText,
    service.maintenanceLabel,
    service.description,
    service.durationMinutes,
    service.featured ? 1 : 0,
    service.active ? 1 : 0,
    service.sortOrder,
    id
  );
  return getServiceById(db, id, { includeInactive: true });
}

function normalizeServiceInput(input) {
  const name = sanitizeText(input.name, 120);
  const applicationPrice = normalizeInteger(input.applicationPrice, input.application_price, 0);
  const maintenancePrice = normalizeNullableInteger(input.maintenancePrice, input.maintenance_price);
  const priceText = sanitizeText(input.priceText || input.price_text || buildPriceText(applicationPrice, maintenancePrice), 180);

  return {
    id: sanitizeText(input.id, 80),
    name,
    image: sanitizeText(input.image || "assets/header.jpg", 300),
    applicationPrice,
    maintenancePrice,
    priceText,
    maintenanceLabel: sanitizeText(input.maintenanceLabel || input.maintenance_label || (maintenancePrice ? `Manutenção R$ ${maintenancePrice}` : "Sem manutenção"), 180),
    description: sanitizeText(input.description, 500),
    durationMinutes: normalizeInteger(input.durationMinutes, input.duration_minutes, 120),
    featured: Boolean(input.featured),
    active: input.active === undefined ? true : Boolean(input.active),
    sortOrder: normalizeInteger(input.sortOrder, input.sort_order, 100)
  };
}

function buildPriceText(applicationPrice, maintenancePrice) {
  const application = `Aplicação R$ ${applicationPrice}`;
  return maintenancePrice ? `${application} | Manutenção R$ ${maintenancePrice}` : application;
}

function getPosts(db, { includeInactive = false } = {}) {
  const rows = db.prepare(`
    SELECT * FROM feed_posts
    WHERE (? = 1 OR active = 1)
    ORDER BY featured DESC, sort_order ASC, created_at DESC
  `).all(includeInactive ? 1 : 0);
  return rows.map(mapPost);
}

function createPost(db, input) {
  const post = normalizePostInput(input);
  const result = db.prepare(`
    INSERT INTO feed_posts (
      title, body, image, cta_label, cta_url, featured, active,
      sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    post.title,
    post.body,
    post.image,
    post.ctaLabel,
    post.ctaUrl,
    post.featured ? 1 : 0,
    post.active ? 1 : 0,
    post.sortOrder
  );
  return getPostById(db, Number(result.lastInsertRowid), { includeInactive: true });
}

function updatePost(db, id, patch) {
  const existing = getPostById(db, id, { includeInactive: true });
  if (!existing) return null;
  const post = normalizePostInput({ ...existing, ...patch });
  db.prepare(`
    UPDATE feed_posts
    SET title = ?, body = ?, image = ?, cta_label = ?, cta_url = ?,
        featured = ?, active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    post.title,
    post.body,
    post.image,
    post.ctaLabel,
    post.ctaUrl,
    post.featured ? 1 : 0,
    post.active ? 1 : 0,
    post.sortOrder,
    id
  );
  return getPostById(db, id, { includeInactive: true });
}

function getPostById(db, id, { includeInactive = false } = {}) {
  const row = db.prepare(`
    SELECT * FROM feed_posts
    WHERE id = ? AND (? = 1 OR active = 1)
  `).get(id, includeInactive ? 1 : 0);
  return row ? mapPost(row) : null;
}

function normalizePostInput(input) {
  return {
    title: sanitizeText(input.title, 160),
    body: sanitizeText(input.body, 1000),
    image: sanitizeText(input.image || "", 300),
    ctaLabel: sanitizeText(input.ctaLabel || input.cta_label || "", 80),
    ctaUrl: sanitizeText(input.ctaUrl || input.cta_url || "", 300),
    featured: Boolean(input.featured),
    active: input.active === undefined ? true : Boolean(input.active),
    sortOrder: normalizeInteger(input.sortOrder, input.sort_order, 100)
  };
}

function getBusinessHours(db) {
  return db.prepare(`
    SELECT * FROM business_hours ORDER BY day_of_week ASC
  `).all().map(mapBusinessHour);
}

function updateBusinessHours(db, days) {
  const update = db.prepare(`
    INSERT INTO business_hours (day_of_week, is_open, times_json, created_at, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(day_of_week) DO UPDATE SET
      is_open = excluded.is_open,
      times_json = excluded.times_json,
      updated_at = CURRENT_TIMESTAMP
  `);

  for (const day of days || []) {
    const dayOfWeek = Number(day.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) continue;
    update.run(dayOfWeek, day.isOpen ? 1 : 0, JSON.stringify(normalizeTimes(day.times)));
  }

  return getBusinessHours(db);
}

function normalizeTimes(times) {
  const values = Array.isArray(times) ? times : String(times || "").split(/\r?\n|,/);
  return values
    .map((time) => String(time).trim())
    .filter((time) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    .sort();
}

function saveUploadedImage(rootDir, file) {
  const mime = sanitizeText(file.mimeType, 80);
  const allowed = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp"
  };
  const extension = allowed[mime];
  if (!extension) {
    const error = new Error("Formato de imagem inválido.");
    error.status = 400;
    throw error;
  }

  const raw = String(file.data || "");
  const base64 = raw.includes(",") ? raw.split(",").pop() : raw;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    const error = new Error("Imagem vazia ou maior que 5 MB.");
    error.status = 400;
    throw error;
  }

  const uploadsDir = path.join(rootDir, "storage", "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const safeName = slugify(path.basename(file.fileName || "imagem", path.extname(file.fileName || ""))) || "imagem";
  const fileName = `${Date.now()}-${safeName}${extension}`;
  fs.writeFileSync(path.join(uploadsDir, fileName), buffer);
  return `/uploads/${fileName}`;
}

function getPublicSite(db) {
  const settings = getSettings(db);
  return {
    settings,
    contact: settings.contact,
    services: getServices(db),
    posts: getPosts(db),
    businessHours: getBusinessHours(db)
  };
}

function mapService(row) {
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    applicationPrice: row.application_price,
    maintenancePrice: row.maintenance_price,
    priceText: row.price_text,
    maintenanceLabel: row.maintenance_label,
    description: row.description,
    durationMinutes: row.duration_minutes,
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPost(row) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    image: row.image || "",
    ctaLabel: row.cta_label || "",
    ctaUrl: row.cta_url || "",
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapBusinessHour(row) {
  let times = [];
  try {
    times = JSON.parse(row.times_json || "[]");
  } catch {
    times = [];
  }
  return {
    dayOfWeek: row.day_of_week,
    isOpen: Boolean(row.is_open),
    times
  };
}

function uniqueServiceId(db, baseId) {
  let id = slugify(baseId) || "servico";
  let suffix = 2;
  while (db.prepare("SELECT 1 FROM services WHERE id = ?").get(id)) {
    id = `${slugify(baseId)}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeInteger(...values) {
  const fallback = values[values.length - 1];
  for (const value of values.slice(0, -1)) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return fallback;
}

function normalizeNullableInteger(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.max(0, Math.round(parsed));
  }
  return null;
}

function sanitizeText(value, max = 500) {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, max);
}

module.exports = {
  seedParameters,
  getSettings,
  updateSettings,
  getPublicSite,
  getServices,
  getServiceById,
  createService,
  updateService,
  getPosts,
  createPost,
  updatePost,
  getBusinessHours,
  updateBusinessHours,
  saveUploadedImage,
  normalizeTimes
};
