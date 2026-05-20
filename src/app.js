const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const {
  addDays,
  formatDateOnly,
  getScheduledTimes,
  isDateBookable,
  normalizeRange,
  parseDateOnly
} = require("./schedule");
const {
  createPost,
  createService,
  getBusinessHours,
  getPosts,
  getPublicSite,
  getServiceById,
  getServices,
  getSettings,
  saveUploadedImage,
  updateBusinessHours,
  updatePost,
  updateService,
  updateSettings
} = require("./site-store");

const ACTIVE_STATUSES = new Set(["pending", "confirmed"]);
const BOOKING_STATUSES = new Set(["pending", "confirmed", "cancelled"]);
const WAITLIST_STATUSES = new Set(["new", "contacted", "closed"]);

function createApp(options) {
  const {
    db,
    publicDir,
    adminPassword,
    now = () => new Date()
  } = options;

  const app = express();
  const sessions = new Map();
  const rootDir = publicDir || path.resolve(__dirname, "..");

  app.disable("x-powered-by");
  app.use(express.json({ limit: "8mb" }));
  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/uploads", express.static(path.join(rootDir, "storage", "uploads"), { maxAge: "1h" }));

  app.get("/health", (req, res) => {
    res.json({ ok: true, name: "yas-femme-studio-local", time: new Date().toISOString() });
  });

  app.get("/api/site", (req, res) => {
    res.json(getPublicSite(db));
  });

  app.get("/api/services", (req, res) => {
    const settings = getSettings(db);
    res.json({
      services: getServices(db),
      contact: settings.contact,
      settings
    });
  });

  app.get("/api/availability", (req, res) => {
    const availability = buildAvailability(db, req.query.from, req.query.to, now());
    res.json(availability);
  });

  app.post("/api/bookings", (req, res) => {
    const body = req.body || {};
    const service = getServiceById(db, sanitizeString(body.serviceId));
    const settings = getSettings(db);
    const businessHours = getBusinessHours(db);
    const date = sanitizeString(body.date);
    const time = sanitizeString(body.time);
    const clientName = sanitizeString(body.clientName);
    const clientPhone = sanitizeString(body.clientPhone);
    const clientAddress = sanitizeString(body.clientAddress);
    const notes = sanitizeString(body.notes || "");

    if (!service || !clientName || !clientPhone || !clientAddress || !date || !time) {
      return res.status(400).json({ error: "Dados obrigatórios ausentes." });
    }

    if (!isDateBookable(date, now(), getBookingOptions(settings, businessHours)) || !getScheduledTimes(date, now(), businessHours).includes(time)) {
      return res.status(400).json({ error: "Horário indisponível para agendamento." });
    }

    if (!isSlotAvailable(db, date, time)) {
      return res.status(409).json({ error: "Este horário acabou de ser reservado." });
    }

    try {
      const insert = db.prepare(`
        INSERT INTO bookings (
          service_id, service_name, service_price, client_name, client_phone,
          client_address, date, time, status, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      const result = insert.run(
        service.id,
        service.name,
        service.applicationPrice,
        clientName,
        clientPhone,
        clientAddress,
        date,
        time,
        notes
      );
      const booking = getBooking(db, Number(result.lastInsertRowid));
      return res.status(201).json({
        booking,
        whatsappUrl: buildBookingWhatsappUrl(settings.contact.whatsappNumber, booking)
      });
    } catch (error) {
      if (String(error.message || "").includes("UNIQUE")) {
        return res.status(409).json({ error: "Este horário acabou de ser reservado." });
      }
      throw error;
    }
  });

  app.post("/api/waitlist", (req, res) => {
    const body = req.body || {};
    const service = getServiceById(db, sanitizeString(body.serviceId), { includeInactive: true });
    const settings = getSettings(db);
    const clientName = sanitizeString(body.clientName);
    const clientPhone = sanitizeString(body.clientPhone);
    const preferredDate = sanitizeString(body.preferredDate || "");
    const period = sanitizeString(body.period);
    const notes = sanitizeString(body.notes || "");

    if (!clientName || !clientPhone || !period) {
      return res.status(400).json({ error: "Nome, WhatsApp e período são obrigatórios." });
    }

    const insert = db.prepare(`
      INSERT INTO waitlist (
        service_id, service_name, service_price, client_name, client_phone,
        preferred_date, period, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    const result = insert.run(
      service ? service.id : null,
      service ? service.name : null,
      service ? service.applicationPrice : null,
      clientName,
      clientPhone,
      preferredDate || null,
      period,
      notes
    );
    const entry = getWaitlistEntry(db, Number(result.lastInsertRowid));
    res.status(201).json({
      entry,
      whatsappUrl: buildWaitlistWhatsappUrl(settings.contact.whatsappNumber, entry)
    });
  });

  app.post("/api/admin/login", (req, res) => {
    const password = String((req.body && req.body.password) || "");
    if (!safeEqual(password, adminPassword)) {
      return res.status(401).json({ error: "Senha inválida." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + 12 * 60 * 60 * 1000);
    res.cookie("yas_admin_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 12 * 60 * 60 * 1000,
      path: "/"
    });
    res.json({ ok: true });
  });

  app.get("/api/admin/session", (req, res) => {
    const token = getCookie(req, "yas_admin_session");
    const expiresAt = token ? sessions.get(token) : null;
    const authenticated = Boolean(expiresAt && expiresAt >= Date.now());
    if (token && !authenticated) sessions.delete(token);
    res.json({ authenticated });
  });

  app.post("/api/admin/logout", requireAdmin(sessions), (req, res) => {
    const token = getCookie(req, "yas_admin_session");
    if (token) sessions.delete(token);
    res.clearCookie("yas_admin_session", { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/admin/settings", requireAdmin(sessions), (req, res) => {
    res.json({ settings: getSettings(db) });
  });

  app.patch("/api/admin/settings", requireAdmin(sessions), (req, res) => {
    res.json({ settings: updateSettings(db, req.body || {}) });
  });

  app.get("/api/admin/services", requireAdmin(sessions), (req, res) => {
    res.json({ services: getServices(db, { includeInactive: true }) });
  });

  app.post("/api/admin/services", requireAdmin(sessions), (req, res) => {
    const service = createService(db, req.body || {});
    res.status(201).json({ service });
  });

  app.patch("/api/admin/services/:id", requireAdmin(sessions), (req, res) => {
    const service = updateService(db, sanitizeString(req.params.id), req.body || {});
    if (!service) return res.status(404).json({ error: "Serviço não encontrado." });
    res.json({ service });
  });

  app.get("/api/admin/posts", requireAdmin(sessions), (req, res) => {
    res.json({ posts: getPosts(db, { includeInactive: true }) });
  });

  app.post("/api/admin/posts", requireAdmin(sessions), (req, res) => {
    const post = createPost(db, req.body || {});
    res.status(201).json({ post });
  });

  app.patch("/api/admin/posts/:id", requireAdmin(sessions), (req, res) => {
    const id = Number(req.params.id);
    const post = Number.isInteger(id) ? updatePost(db, id, req.body || {}) : null;
    if (!post) return res.status(404).json({ error: "Publicação não encontrada." });
    res.json({ post });
  });

  app.get("/api/admin/business-hours", requireAdmin(sessions), (req, res) => {
    res.json({ businessHours: getBusinessHours(db) });
  });

  app.patch("/api/admin/business-hours", requireAdmin(sessions), (req, res) => {
    res.json({ businessHours: updateBusinessHours(db, (req.body || {}).days || []) });
  });

  app.post("/api/admin/uploads", requireAdmin(sessions), (req, res) => {
    const upload = saveUploadedImage(rootDir, req.body || {});
    res.status(201).json({ url: upload });
  });

  app.get("/api/admin/agenda", requireAdmin(sessions), (req, res) => {
    const status = sanitizeString(req.query.status || "");
    const availability = buildAvailability(db, req.query.from, req.query.to, now());
    const { start, end } = normalizeAdminAgendaRange(req.query.from, req.query.to, availability);
    const from = formatDateOnly(start);
    const to = formatDateOnly(end);
    const rows = db.prepare(`
      SELECT * FROM bookings
      WHERE date BETWEEN ? AND ? AND (? = '' OR status = ?)
      ORDER BY date ASC, time ASC, created_at DESC
      LIMIT 500
    `).all(from, to, status, status).map(mapBooking);

    res.json({
      from,
      to,
      availability,
      bookings: rows
    });
  });

  app.get("/api/admin/bookings", requireAdmin(sessions), (req, res) => {
    const status = sanitizeString(req.query.status || "");
    const rows = db.prepare(`
      SELECT * FROM bookings
      WHERE (? = '' OR status = ?)
      ORDER BY date ASC, time ASC, created_at DESC
      LIMIT 300
    `).all(status, status).map(mapBooking);
    res.json({ bookings: rows });
  });

  app.patch("/api/admin/bookings/:id", requireAdmin(sessions), (req, res) => {
    const id = Number(req.params.id);
    const status = sanitizeString(req.body && req.body.status);
    const adminNotes = sanitizeString((req.body && req.body.adminNotes) || "");

    if (!Number.isInteger(id) || id <= 0 || !BOOKING_STATUSES.has(status)) {
      return res.status(400).json({ error: "Atualização inválida." });
    }

    const booking = getBooking(db, id);
    if (!booking) return res.status(404).json({ error: "Reserva não encontrada." });

    if (ACTIVE_STATUSES.has(status) && !isSlotAvailable(db, booking.date, booking.time, id)) {
      return res.status(409).json({ error: "Outro agendamento já ocupa este horário." });
    }

    db.prepare(`
      UPDATE bookings
      SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, adminNotes, id);

    res.json({ booking: getBooking(db, id) });
  });

  app.get("/api/admin/waitlist", requireAdmin(sessions), (req, res) => {
    const status = sanitizeString(req.query.status || "");
    const rows = db.prepare(`
      SELECT * FROM waitlist
      WHERE (? = '' OR status = ?)
      ORDER BY created_at DESC
      LIMIT 300
    `).all(status, status).map(mapWaitlist);
    res.json({ waitlist: rows });
  });

  app.patch("/api/admin/waitlist/:id", requireAdmin(sessions), (req, res) => {
    const id = Number(req.params.id);
    const status = sanitizeString(req.body && req.body.status);

    if (!Number.isInteger(id) || id <= 0 || !WAITLIST_STATUSES.has(status)) {
      return res.status(400).json({ error: "Atualização inválida." });
    }

    const entry = getWaitlistEntry(db, id);
    if (!entry) return res.status(404).json({ error: "Entrada não encontrada." });

    db.prepare(`
      UPDATE waitlist
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, id);

    res.json({ entry: getWaitlistEntry(db, id) });
  });

  app.use(express.static(rootDir, {
    extensions: ["html"],
    maxAge: "1h"
  }));

  app.use((req, res) => {
    res.status(404).json({ error: "Rota não encontrada." });
  });

  app.use((error, req, res, next) => {
    if (!error.status || error.status >= 500) {
      console.error(error);
    }
    res.status(error.status || 500).json({ error: error.message || "Erro interno do servidor." });
  });

  return app;
}

function buildAvailability(db, from, to, now) {
  const settings = getSettings(db);
  const businessHours = getBusinessHours(db);
  const maxDays = Number(settings.site.bookingMaxDays) || 60;
  const { start, end } = normalizeRange(from, to, now, maxDays);
  const activeRows = db.prepare(`
    SELECT date, time, status FROM bookings
    WHERE status IN ('pending', 'confirmed') AND date BETWEEN ? AND ?
  `).all(formatDateOnly(start), formatDateOnly(end));

  const activeMap = new Map();
  for (const row of activeRows) {
    activeMap.set(`${row.date}|${row.time}`, row.status);
  }

  const days = [];
  let availableCount = 0;
  let totalCount = 0;
  let nextAvailable = null;

  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    const date = formatDateOnly(cursor);
    const isBookable = isDateBookable(date, now, getBookingOptions(settings, businessHours));
    const times = isBookable ? getScheduledTimes(date, now, businessHours) : [];
    const slots = times.map((time) => {
      const status = activeMap.get(`${date}|${time}`) || null;
      const available = !status;
      totalCount += 1;
      if (available) {
        availableCount += 1;
        if (!nextAvailable) nextAvailable = { date, time };
      }
      return { time, available, status };
    });

    days.push({
      date,
      isOpen: slots.length > 0,
      slots
    });
  }

  return {
    from: formatDateOnly(start),
    to: formatDateOnly(end),
    nextAvailable,
    totalSlots: totalCount,
    availableSlots: availableCount,
    days
  };
}

function getBookingOptions(settings, businessHours) {
  return {
    maxBookingDays: Number(settings.site.bookingMaxDays) || 60,
    businessHours
  };
}

function normalizeAdminAgendaRange(from, to, availability) {
  const fallbackStart = parseDateOnly(availability.from) || new Date();
  const start = parseDateOnly(from) || fallbackStart;
  const end = parseDateOnly(to) || parseDateOnly(availability.to) || start;
  if (end < start) return { start, end: start };
  return { start, end };
}

function isSlotAvailable(db, date, time, excludeId = null) {
  const row = db.prepare(`
    SELECT id FROM bookings
    WHERE date = ? AND time = ? AND status IN ('pending', 'confirmed') AND (? IS NULL OR id != ?)
    LIMIT 1
  `).get(date, time, excludeId, excludeId);
  return !row;
}

function getBooking(db, id) {
  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
  return row ? mapBooking(row) : null;
}

function getWaitlistEntry(db, id) {
  const row = db.prepare("SELECT * FROM waitlist WHERE id = ?").get(id);
  return row ? mapWaitlist(row) : null;
}

function mapBooking(row) {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    servicePrice: row.service_price,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientAddress: row.client_address,
    date: row.date,
    time: row.time,
    status: row.status,
    notes: row.notes || "",
    adminNotes: row.admin_notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapWaitlist(row) {
  return {
    id: row.id,
    serviceId: row.service_id,
    serviceName: row.service_name,
    servicePrice: row.service_price,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    preferredDate: row.preferred_date,
    period: row.period,
    notes: row.notes || "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sanitizeString(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 500);
}

function buildBookingWhatsappUrl(whatsappNumber, booking) {
  const message = [
    "Olá! Solicitei um agendamento pelo catálogo.",
    "",
    `Nome: ${booking.clientName}`,
    `Telefone: ${booking.clientPhone}`,
    `Endereço: ${booking.clientAddress}`,
    "",
    `Serviço: ${booking.serviceName}`,
    `Valor: R$ ${booking.servicePrice},00`,
    `Data: ${booking.date}`,
    `Horário: ${booking.time}`,
    "",
    "Aguardo confirmação."
  ].join("\n");
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function buildWaitlistWhatsappUrl(whatsappNumber, entry) {
  const message = [
    "Olá! Entrei na lista de espera pelo catálogo.",
    "",
    `Nome: ${entry.clientName}`,
    `Telefone: ${entry.clientPhone}`,
    `Serviço: ${entry.serviceName || "Não especificado"}`,
    `Período: ${entry.period}`,
    entry.preferredDate ? `Data preferida: ${entry.preferredDate}` : "",
    entry.notes ? `Observações: ${entry.notes}` : ""
  ].filter(Boolean).join("\n");
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function getCookie(req, name) {
  const header = req.headers.cookie || "";
  const parts = header.split(";").map((part) => part.trim());
  const prefix = `${name}=`;
  const match = parts.find((part) => part.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

function requireAdmin(sessions) {
  return (req, res, next) => {
    const token = getCookie(req, "yas_admin_session");
    const expiresAt = token ? sessions.get(token) : null;
    if (!expiresAt || expiresAt < Date.now()) {
      if (token) sessions.delete(token);
      return res.status(401).json({ error: "Acesso administrativo necessário." });
    }
    next();
  };
}

module.exports = {
  createApp,
  buildAvailability,
  buildBookingWhatsappUrl,
  buildWaitlistWhatsappUrl
};
