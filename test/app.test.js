const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("../src/app");
const { openDatabase } = require("../src/db");

const fixedNow = () => new Date(2026, 4, 20, 10, 0, 0);

async function withServer(t) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "yas-femme-test-"));
  const db = openDatabase(path.join(tempDir, "test.sqlite"));
  const app = createApp({
    db,
    publicDir: tempDir,
    adminPassword: "senha-teste",
    whatsappNumber: "557381676132",
    publicBaseUrl: "https://yasfemmestudio.sirel.com.br",
    now: fixedNow
  });

  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  t.after(() => {
    server.close();
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  return { baseUrl };
}

async function request(baseUrl, pathName, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function createBooking(baseUrl, overrides = {}) {
  return request(baseUrl, "/api/bookings", {
    method: "POST",
    body: JSON.stringify({
      serviceId: "volume-brasileiro",
      clientName: "Cliente Teste",
      clientPhone: "(73) 99999-0000",
      clientAddress: "Rua Teste, 10",
      date: "2026-05-21",
      time: "19:00",
      ...overrides
    })
  });
}

async function login(baseUrl, password = "senha-teste") {
  const { response, data } = await request(baseUrl, "/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password })
  });
  return { response, data, cookie: response.headers.get("set-cookie") };
}

test("cria reserva pendente e bloqueia o horario", async (t) => {
  const { baseUrl } = await withServer(t);
  const created = await createBooking(baseUrl);

  assert.equal(created.response.status, 201);
  assert.equal(created.data.booking.status, "pending");

  const availability = await request(baseUrl, "/api/availability?from=2026-05-21&to=2026-05-21");
  const day = availability.data.days[0];
  const slot = day.slots.find((item) => item.time === "19:00");
  assert.equal(slot.available, false);
  assert.equal(slot.status, "pending");
});

test("impede segunda reserva no mesmo horario ativo", async (t) => {
  const { baseUrl } = await withServer(t);
  await createBooking(baseUrl);
  const duplicate = await createBooking(baseUrl, { clientName: "Outra Cliente" });

  assert.equal(duplicate.response.status, 409);
});

test("cancelar uma reserva libera o horario", async (t) => {
  const { baseUrl } = await withServer(t);
  const created = await createBooking(baseUrl);
  const auth = await login(baseUrl);

  assert.ok(auth.cookie);

  const cancelled = await request(baseUrl, `/api/admin/bookings/${created.data.booking.id}`, {
    method: "PATCH",
    headers: { Cookie: auth.cookie },
    body: JSON.stringify({ status: "cancelled" })
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.data.booking.status, "cancelled");

  const availability = await request(baseUrl, "/api/availability?from=2026-05-21&to=2026-05-21");
  const slot = availability.data.days[0].slots.find((item) => item.time === "19:00");
  assert.equal(slot.available, true);
});

test("agenda admin retorna disponibilidade e reservas no intervalo", async (t) => {
  const { baseUrl } = await withServer(t);
  const created = await createBooking(baseUrl);
  const auth = await login(baseUrl);

  const agenda = await request(baseUrl, "/api/admin/agenda?from=2026-05-20&to=2026-05-23", {
    headers: { Cookie: auth.cookie }
  });

  assert.equal(agenda.response.status, 200);
  assert.equal(agenda.data.from, "2026-05-20");
  assert.equal(agenda.data.to, "2026-05-23");
  assert.equal(agenda.data.bookings.length, 1);
  assert.equal(agenda.data.bookings[0].id, created.data.booking.id);
  assert.equal(agenda.data.availability.days.some((day) => day.date === "2026-05-21"), true);

  const pendingOnly = await request(baseUrl, "/api/admin/agenda?from=2026-05-20&to=2026-05-23&status=pending", {
    headers: { Cookie: auth.cookie }
  });
  assert.equal(pendingOnly.data.bookings.length, 1);
});

test("passado e domingo nao ficam disponiveis", async (t) => {
  const { baseUrl } = await withServer(t);
  const availability = await request(baseUrl, "/api/availability?from=2026-05-19&to=2026-05-24");

  assert.equal(availability.response.status, 200);
  assert.equal(availability.data.from, "2026-05-20");
  const sunday = availability.data.days.find((day) => day.date === "2026-05-24");
  assert.deepEqual(sunday.slots, []);
  assert.equal(sunday.isOpen, false);
});

test("login admin rejeita senha errada e aceita senha correta", async (t) => {
  const { baseUrl } = await withServer(t);
  const wrong = await login(baseUrl, "errada");
  assert.equal(wrong.response.status, 401);

  const right = await login(baseUrl);
  assert.equal(right.response.status, 200);
  assert.ok(right.cookie.includes("yas_admin_session"));
});

test("lista de espera persiste e aparece no admin", async (t) => {
  const { baseUrl } = await withServer(t);
  const entry = await request(baseUrl, "/api/waitlist", {
    method: "POST",
    body: JSON.stringify({
      serviceId: "anime",
      clientName: "Cliente Espera",
      clientPhone: "(73) 98888-1111",
      preferredDate: "2026-05-23",
      period: "quinzena",
      notes: "Prefere sabado"
    })
  });

  assert.equal(entry.response.status, 201);
  assert.equal(entry.data.entry.status, "new");

  const auth = await login(baseUrl);
  const list = await request(baseUrl, "/api/admin/waitlist", {
    headers: { Cookie: auth.cookie }
  });

  assert.equal(list.response.status, 200);
  assert.equal(list.data.waitlist.length, 1);
  assert.equal(list.data.waitlist[0].clientName, "Cliente Espera");
});

test("seed inicial cria servicos atuais e Tecnica Fox Gatinho", async (t) => {
  const { baseUrl } = await withServer(t);
  const site = await request(baseUrl, "/api/site");

  assert.equal(site.response.status, 200);
  const fox = site.data.services.find((service) => service.id === "fox-gatinho");
  assert.ok(fox);
  assert.equal(fox.name, "Técnica Fox Gatinho");
  assert.equal(fox.applicationPrice, 145);
  assert.equal(fox.maintenancePrice, 130);
  assert.equal(fox.image, "assets/fox.png");
});

test("edicao admin de servico aparece no catalogo publico", async (t) => {
  const { baseUrl } = await withServer(t);
  const auth = await login(baseUrl);

  const updated = await request(baseUrl, "/api/admin/services/fox-gatinho", {
    method: "PATCH",
    headers: { Cookie: auth.cookie },
    body: JSON.stringify({
      name: "Técnica Fox Gatinho Premium",
      applicationPrice: 150,
      active: true
    })
  });

  assert.equal(updated.response.status, 200);
  const site = await request(baseUrl, "/api/site");
  const service = site.data.services.find((item) => item.id === "fox-gatinho");
  assert.equal(service.name, "Técnica Fox Gatinho Premium");
  assert.equal(service.applicationPrice, 150);
});

test("servico inativo nao aparece no publico, mas reserva historica permanece", async (t) => {
  const { baseUrl } = await withServer(t);
  const created = await createBooking(baseUrl, {
    serviceId: "fox-gatinho",
    date: "2026-05-21",
    time: "21:00"
  });
  assert.equal(created.response.status, 201);

  const auth = await login(baseUrl);
  await request(baseUrl, "/api/admin/services/fox-gatinho", {
    method: "PATCH",
    headers: { Cookie: auth.cookie },
    body: JSON.stringify({ active: false })
  });

  const site = await request(baseUrl, "/api/site");
  assert.equal(site.data.services.some((service) => service.id === "fox-gatinho"), false);

  const bookings = await request(baseUrl, "/api/admin/bookings", {
    headers: { Cookie: auth.cookie }
  });
  assert.equal(bookings.data.bookings.length, 1);
  assert.equal(bookings.data.bookings[0].serviceId, "fox-gatinho");
});

test("horarios editados no admin alteram disponibilidade", async (t) => {
  const { baseUrl } = await withServer(t);
  const auth = await login(baseUrl);

  const updated = await request(baseUrl, "/api/admin/business-hours", {
    method: "PATCH",
    headers: { Cookie: auth.cookie },
    body: JSON.stringify({
      days: [{ dayOfWeek: 4, isOpen: true, times: ["18:00"] }]
    })
  });
  assert.equal(updated.response.status, 200);

  const availability = await request(baseUrl, "/api/availability?from=2026-05-21&to=2026-05-21");
  assert.deepEqual(availability.data.days[0].slots.map((slot) => slot.time), ["18:00"]);
});

test("pagamentos e contatos atualizados aparecem em api site", async (t) => {
  const { baseUrl } = await withServer(t);
  const auth = await login(baseUrl);

  const updated = await request(baseUrl, "/api/admin/settings", {
    method: "PATCH",
    headers: { Cookie: auth.cookie },
    body: JSON.stringify({
      contact: {
        whatsappNumber: "5500000000000",
        pixKey: "pix-teste"
      },
      payments: {
        pix: true,
        cash: true,
        debit: ["Visa Teste"],
        credit: ["Crédito Teste"],
        vouchers: ["Voucher Teste"]
      }
    })
  });
  assert.equal(updated.response.status, 200);

  const site = await request(baseUrl, "/api/site");
  assert.equal(site.data.contact.whatsappNumber, "5500000000000");
  assert.equal(site.data.contact.pixKey, "pix-teste");
  assert.deepEqual(site.data.settings.payments.debit, ["Visa Teste"]);
  assert.deepEqual(site.data.settings.payments.credit, ["Crédito Teste"]);
  assert.deepEqual(site.data.settings.payments.vouchers, ["Voucher Teste"]);
});

test("publicacao ativa aparece no feed e inativa nao aparece", async (t) => {
  const { baseUrl } = await withServer(t);
  const auth = await login(baseUrl);

  const created = await request(baseUrl, "/api/admin/posts", {
    method: "POST",
    headers: { Cookie: auth.cookie },
    body: JSON.stringify({
      title: "Promoção de Maio",
      body: "Condição especial para novos agendamentos.",
      active: true,
      featured: true
    })
  });

  assert.equal(created.response.status, 201);
  let site = await request(baseUrl, "/api/site");
  assert.equal(site.data.posts.some((post) => post.title === "Promoção de Maio"), true);

  await request(baseUrl, `/api/admin/posts/${created.data.post.id}`, {
    method: "PATCH",
    headers: { Cookie: auth.cookie },
    body: JSON.stringify({ active: false })
  });

  site = await request(baseUrl, "/api/site");
  assert.equal(site.data.posts.some((post) => post.title === "Promoção de Maio"), false);
});

test("upload aceita imagens validas e rejeita tipos invalidos", async (t) => {
  const { baseUrl } = await withServer(t);
  const auth = await login(baseUrl);
  const onePixelPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

  const valid = await request(baseUrl, "/api/admin/uploads", {
    method: "POST",
    headers: { Cookie: auth.cookie },
    body: JSON.stringify({
      fileName: "teste.png",
      mimeType: "image/png",
      data: onePixelPng
    })
  });
  assert.equal(valid.response.status, 201);
  assert.match(valid.data.url, /^\/uploads\/\d+-teste\.png$/);

  const invalid = await request(baseUrl, "/api/admin/uploads", {
    method: "POST",
    headers: { Cookie: auth.cookie },
    body: JSON.stringify({
      fileName: "teste.txt",
      mimeType: "text/plain",
      data: Buffer.from("nao e imagem").toString("base64")
    })
  });
  assert.equal(invalid.response.status, 400);
});
