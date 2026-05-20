const adminState = {
  services: [],
  posts: [],
  settings: {},
  businessHours: [],
  agendaView: "month",
  agendaCursor: startOfMonth(new Date()),
  agendaSelectedDate: formatDateISO(new Date()),
  agendaData: null
};

const statusLabels = {
  pending: "Pendente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  new: "Nova",
  contacted: "Contatada",
  closed: "Encerrada"
};

const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const shortDayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginForm").addEventListener("submit", login);
  document.getElementById("logoutButton").addEventListener("click", logout);
  document.getElementById("refreshButton").addEventListener("click", loadAdminData);
  document.getElementById("bookingStatusFilter").addEventListener("change", () => {
    loadBookings();
    loadAgenda();
  });
  document.getElementById("waitlistStatusFilter").addEventListener("change", loadWaitlist);

  document.querySelectorAll("[data-agenda-view]").forEach((button) => {
    button.addEventListener("click", () => setAgendaView(button.dataset.agendaView));
  });
  document.getElementById("agendaPrev").addEventListener("click", () => moveAgenda(-1));
  document.getElementById("agendaNext").addEventListener("click", () => moveAgenda(1));
  document.getElementById("agendaToday").addEventListener("click", () => {
    adminState.agendaCursor = adminState.agendaView === "month" ? startOfMonth(new Date()) : new Date();
    adminState.agendaSelectedDate = formatDateISO(new Date());
    loadAgenda();
  });

  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.adminTab));
  });

  document.getElementById("serviceForm").addEventListener("submit", submitService);
  document.getElementById("resetServiceForm").addEventListener("click", resetServiceForm);
  document.getElementById("postForm").addEventListener("submit", submitPost);
  document.getElementById("resetPostForm").addEventListener("click", resetPostForm);
  document.getElementById("hoursForm").addEventListener("submit", submitBusinessHours);
  document.getElementById("contactForm").addEventListener("submit", submitContactSettings);
  document.getElementById("paymentForm").addEventListener("submit", submitPaymentSettings);
  document.getElementById("siteForm").addEventListener("submit", submitSiteSettings);

  checkSession();
});

async function adminApi(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Falha na ação administrativa.");
  }
  return data;
}

async function login(event) {
  event.preventDefault();
  document.getElementById("loginError").textContent = "";
  try {
    await adminApi("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: document.getElementById("adminPassword").value })
    });
    document.getElementById("adminPassword").value = "";
    await loadAdminData();
  } catch (error) {
    document.getElementById("loginError").textContent = error.message;
  }
}

async function logout() {
  await adminApi("/api/admin/logout", { method: "POST" }).catch(() => {});
  showLogin();
}

async function checkSession() {
  const data = await adminApi("/api/admin/session").catch(() => ({ authenticated: false }));
  if (data.authenticated) {
    await loadAdminData();
  } else {
    showLogin();
  }
}

async function loadAdminData() {
  try {
    await Promise.all([
      loadBookings(),
      loadWaitlist(),
      loadSettings(),
      loadServices(),
      loadPosts(),
      loadBusinessHours(),
      loadAgenda()
    ]);
    populateSettingsForms();
    showDashboard();
    showNotice("Dados carregados.");
  } catch (error) {
    showLogin();
  }
}

async function loadBookings() {
  const status = document.getElementById("bookingStatusFilter").value;
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await adminApi(`/api/admin/bookings${query}`);
  const list = document.getElementById("bookingsList");
  if (!data.bookings.length) {
    list.innerHTML = "<p class=\"empty-state\">Nenhuma reserva encontrada.</p>";
    return;
  }
  list.innerHTML = data.bookings.map(renderBooking).join("");
  bindBookingActions(list);
}

async function loadWaitlist() {
  const status = document.getElementById("waitlistStatusFilter").value;
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await adminApi(`/api/admin/waitlist${query}`);
  const list = document.getElementById("waitlistList");
  if (!data.waitlist.length) {
    list.innerHTML = "<p class=\"empty-state\">Nenhuma entrada na lista de espera.</p>";
    return;
  }
  list.innerHTML = data.waitlist.map(renderWaitlist).join("");
  list.querySelectorAll("[data-waitlist-status]").forEach((button) => {
    button.addEventListener("click", () => updateWaitlist(button.dataset.waitlistId, button.dataset.waitlistStatus));
  });
}

async function loadSettings() {
  const data = await adminApi("/api/admin/settings");
  adminState.settings = data.settings || {};
}

async function loadServices() {
  const data = await adminApi("/api/admin/services");
  adminState.services = data.services || [];
  renderServicesList();
}

async function loadPosts() {
  const data = await adminApi("/api/admin/posts");
  adminState.posts = data.posts || [];
  renderPostsList();
}

async function loadBusinessHours() {
  const data = await adminApi("/api/admin/business-hours");
  adminState.businessHours = data.businessHours || [];
  renderHoursEditor();
}

async function loadAgenda() {
  const { from, to } = getAgendaRange();
  const params = new URLSearchParams({ from, to });
  const status = document.getElementById("bookingStatusFilter").value;
  if (status) params.set("status", status);

  const data = await adminApi(`/api/admin/agenda?${params.toString()}`);
  adminState.agendaData = data;
  if (!isDateInRange(adminState.agendaSelectedDate, data.from, data.to)) {
    const today = formatDateISO(new Date());
    adminState.agendaSelectedDate = isDateInRange(today, data.from, data.to) ? today : data.from;
  }
  renderAgenda();
}

function setAgendaView(view) {
  adminState.agendaView = view === "week" ? "week" : "month";
  if (adminState.agendaView === "month") {
    adminState.agendaCursor = startOfMonth(parseDateOnly(adminState.agendaSelectedDate));
  } else {
    adminState.agendaCursor = parseDateOnly(adminState.agendaSelectedDate);
  }
  loadAgenda();
}

function moveAgenda(direction) {
  const cursor = new Date(adminState.agendaCursor);
  if (adminState.agendaView === "month") {
    cursor.setMonth(cursor.getMonth() + direction);
    adminState.agendaCursor = startOfMonth(cursor);
  } else {
    cursor.setDate(cursor.getDate() + direction * 7);
    adminState.agendaCursor = cursor;
  }
  adminState.agendaSelectedDate = formatDateISO(adminState.agendaView === "month" ? adminState.agendaCursor : startOfWeek(adminState.agendaCursor));
  loadAgenda();
}

function renderAgenda() {
  const data = adminState.agendaData;
  if (!data) return;

  document.querySelectorAll("[data-agenda-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.agendaView === adminState.agendaView);
  });

  const bookings = data.bookings || [];
  const pendingCount = bookings.filter((booking) => booking.status === "pending").length;
  const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;
  const cancelledCount = bookings.filter((booking) => booking.status === "cancelled").length;
  const visualRange = getAgendaRange();
  document.getElementById("agendaRangeLabel").textContent = getAgendaRangeLabel(visualRange.from, visualRange.to);
  document.getElementById("agendaStatsText").textContent =
    `${data.availability.availableSlots} livres de ${data.availability.totalSlots} horários | ${pendingCount} pendentes | ${confirmedCount} confirmadas | ${cancelledCount} canceladas`;

  if (adminState.agendaView === "week") {
    renderWeekAgenda();
  } else {
    renderMonthAgenda();
  }
  renderAgendaDayDetails();
}

function renderMonthAgenda() {
  const data = adminState.agendaData;
  const calendar = document.getElementById("agendaCalendar");
  const cursor = startOfMonth(adminState.agendaCursor);
  const first = startOfMonth(cursor);
  const last = endOfMonth(cursor);
  const availabilityByDate = new Map(data.availability.days.map((day) => [day.date, day]));
  const bookingsByDate = groupBookingsByDate(data.bookings || []);

  let html = shortDayNames.map((day) => `<div class="agenda-weekday">${day}</div>`).join("");
  for (let i = 0; i < first.getDay(); i += 1) {
    html += "<div class=\"agenda-month-empty\"></div>";
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
    const dateString = formatDateISO(date);
    const availability = availabilityByDate.get(dateString);
    const bookings = bookingsByDate.get(dateString) || [];
    const pendingCount = bookings.filter((booking) => booking.status === "pending").length;
    const confirmedCount = bookings.filter((booking) => booking.status === "confirmed").length;
    const cancelledCount = bookings.filter((booking) => booking.status === "cancelled").length;
    const availableSlots = availability ? availability.slots.filter((slot) => slot.available).length : 0;
    const isMuted = !availability;

    html += `
      <button class="agenda-month-day ${dateString === adminState.agendaSelectedDate ? "selected" : ""} ${isMuted ? "muted" : ""}" type="button" data-agenda-date="${dateString}">
        <span class="agenda-date-number">${day}</span>
        <span class="agenda-date-meta">${availability ? `${availableSlots} livres` : "fora do período"}</span>
        <span class="agenda-date-pills">
          ${pendingCount ? `<i class="mini-pill pending">${pendingCount}</i>` : ""}
          ${confirmedCount ? `<i class="mini-pill confirmed">${confirmedCount}</i>` : ""}
          ${cancelledCount ? `<i class="mini-pill cancelled">${cancelledCount}</i>` : ""}
        </span>
      </button>
    `;
  }

  calendar.className = "agenda-calendar agenda-month";
  calendar.innerHTML = html;
  calendar.querySelectorAll("[data-agenda-date]").forEach((button) => {
    button.addEventListener("click", () => selectAgendaDate(button.dataset.agendaDate));
  });
}

function renderWeekAgenda() {
  const data = adminState.agendaData;
  const calendar = document.getElementById("agendaCalendar");
  const weekStart = startOfWeek(adminState.agendaCursor);
  const availabilityByDate = new Map(data.availability.days.map((day) => [day.date, day]));
  const bookingsBySlot = groupBookingsBySlot(data.bookings || []);
  const bookingsByDate = groupBookingsByDate(data.bookings || []);

  const columns = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)).map((date) => {
    const dateString = formatDateISO(date);
    const availability = availabilityByDate.get(dateString);
    const slots = availability ? availability.slots : [];
    const dayBookings = bookingsByDate.get(dateString) || [];
    const looseBookings = dayBookings.filter((booking) => !slots.some((slot) => slot.time === booking.time));

    return `
      <section class="agenda-week-day ${dateString === adminState.agendaSelectedDate ? "selected" : ""}" data-agenda-date="${dateString}">
        <button class="agenda-week-header" type="button" data-agenda-date="${dateString}">
          <span>${shortDayNames[date.getDay()]}</span>
          <strong>${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}</strong>
        </button>
        <div class="agenda-slot-list">
          ${slots.length ? slots.map((slot) => renderAgendaSlot(dateString, slot, bookingsBySlot.get(`${dateString}|${slot.time}`))).join("") : "<p class=\"empty-state small\">Fechado</p>"}
          ${looseBookings.map((booking) => renderAgendaLooseBooking(booking)).join("")}
        </div>
      </section>
    `;
  }).join("");

  calendar.className = "agenda-calendar agenda-week";
  calendar.innerHTML = columns;
  calendar.querySelectorAll("[data-agenda-date]").forEach((button) => {
    button.addEventListener("click", () => selectAgendaDate(button.dataset.agendaDate));
  });
}

function renderAgendaSlot(dateString, slot, booking) {
  const status = booking ? booking.status : slot.status;
  const statusClass = status || (slot.available ? "available" : "blocked");
  return `
    <button class="agenda-slot ${statusClass}" type="button" data-agenda-date="${dateString}">
      <strong>${escapeHtml(slot.time)}</strong>
      <span>${booking ? escapeHtml(booking.clientName) : (slot.available ? "Livre" : statusLabels[status] || "Ocupado")}</span>
      ${booking ? `<small>${escapeHtml(booking.serviceName)}</small>` : ""}
    </button>
  `;
}

function renderAgendaLooseBooking(booking) {
  return `
    <button class="agenda-slot ${escapeAttribute(booking.status)} loose" type="button" data-agenda-date="${escapeAttribute(booking.date)}">
      <strong>${escapeHtml(booking.time)}</strong>
      <span>${escapeHtml(booking.clientName)}</span>
      <small>${escapeHtml(statusLabels[booking.status])}</small>
    </button>
  `;
}

function renderAgendaDayDetails() {
  const data = adminState.agendaData;
  const panel = document.getElementById("agendaDayDetails");
  const selectedDate = adminState.agendaSelectedDate;
  const bookings = (data.bookings || []).filter((booking) => booking.date === selectedDate);
  const day = (data.availability.days || []).find((item) => item.date === selectedDate);
  const slots = day ? day.slots : [];
  const availableCount = slots.filter((slot) => slot.available).length;

  panel.innerHTML = `
    <div class="agenda-detail-heading">
      <div>
        <span class="eyebrow">Dia selecionado</span>
        <h3>${formatDateBR(selectedDate)}</h3>
      </div>
      <span>${availableCount} livres de ${slots.length} horários</span>
    </div>
    <div class="agenda-detail-grid">
      <div>
        <h4>Reservas</h4>
        ${bookings.length ? bookings.map(renderAgendaBooking).join("") : "<p class=\"empty-state small\">Nenhuma reserva neste dia.</p>"}
      </div>
      <div>
        <h4>Horários</h4>
        ${slots.length ? slots.map((slot) => `
          <div class="agenda-detail-slot ${slot.available ? "available" : slot.status}">
            <strong>${escapeHtml(slot.time)}</strong>
            <span>${slot.available ? "Livre" : statusLabels[slot.status] || "Ocupado"}</span>
          </div>
        `).join("") : "<p class=\"empty-state small\">Sem horários configurados.</p>"}
      </div>
    </div>
  `;
  bindBookingActions(panel);
}

function renderAgendaBooking(booking) {
  return `
    <article class="agenda-booking-row">
      <div>
        <span class="status-pill status-${escapeAttribute(booking.status)}">${escapeHtml(statusLabels[booking.status])}</span>
        <h5>${escapeHtml(booking.time)} - ${escapeHtml(booking.clientName)}</h5>
        <p>${escapeHtml(booking.serviceName)} | ${escapeHtml(booking.clientPhone)}</p>
      </div>
      <div class="admin-card-actions">
        <a class="button button-dark" href="${escapeAttribute(clientWhatsapp(booking.clientPhone, `Olá, ${booking.clientName}! Sobre sua solicitação de ${booking.serviceName} para ${formatDateBR(booking.date)} às ${booking.time}.`))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <button class="button button-primary" data-booking-id="${booking.id}" data-booking-status="confirmed" ${booking.status === "confirmed" ? "disabled" : ""}>Confirmar</button>
        <button class="button button-soft" data-booking-id="${booking.id}" data-booking-status="cancelled" ${booking.status === "cancelled" ? "disabled" : ""}>Cancelar</button>
      </div>
    </article>
  `;
}

function selectAgendaDate(dateString) {
  adminState.agendaSelectedDate = dateString;
  if (adminState.agendaView === "week") {
    adminState.agendaCursor = parseDateOnly(dateString);
  }
  renderAgenda();
}

function bindBookingActions(root) {
  root.querySelectorAll("[data-booking-status]").forEach((button) => {
    button.addEventListener("click", () => updateBooking(button.dataset.bookingId, button.dataset.bookingStatus));
  });
}

function renderBooking(booking) {
  return `
    <article class="admin-card">
      <div>
        <span class="status-pill status-${escapeAttribute(booking.status)}">${escapeHtml(statusLabels[booking.status])}</span>
        <h3>${escapeHtml(booking.clientName)} - ${escapeHtml(booking.serviceName)}</h3>
        <p>${formatDateBR(booking.date)} às ${escapeHtml(booking.time)} | R$ ${escapeHtml(booking.servicePrice)},00</p>
        <p>WhatsApp: ${escapeHtml(booking.clientPhone)}</p>
        <p>Endereço: ${escapeHtml(booking.clientAddress)}</p>
        ${booking.notes ? `<p>Obs.: ${escapeHtml(booking.notes)}</p>` : ""}
      </div>
      <div class="admin-card-actions">
        <a class="button button-dark" href="${escapeAttribute(clientWhatsapp(booking.clientPhone, `Olá, ${booking.clientName}! Sobre sua solicitação de ${booking.serviceName} para ${formatDateBR(booking.date)} às ${booking.time}.`))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <button class="button button-primary" data-booking-id="${booking.id}" data-booking-status="confirmed" ${booking.status === "confirmed" ? "disabled" : ""}>Confirmar</button>
        <button class="button button-soft" data-booking-id="${booking.id}" data-booking-status="cancelled" ${booking.status === "cancelled" ? "disabled" : ""}>Cancelar</button>
      </div>
    </article>
  `;
}

function renderWaitlist(entry) {
  return `
    <article class="admin-card">
      <div>
        <span class="status-pill status-${escapeAttribute(entry.status)}">${escapeHtml(statusLabels[entry.status])}</span>
        <h3>${escapeHtml(entry.clientName)} - ${escapeHtml(entry.serviceName || "Serviço não especificado")}</h3>
        <p>WhatsApp: ${escapeHtml(entry.clientPhone)}</p>
        <p>Período: ${escapeHtml(entry.period)}${entry.preferredDate ? ` | Preferência: ${formatDateBR(entry.preferredDate)}` : ""}</p>
        ${entry.notes ? `<p>Obs.: ${escapeHtml(entry.notes)}</p>` : ""}
      </div>
      <div class="admin-card-actions">
        <a class="button button-dark" href="${escapeAttribute(clientWhatsapp(entry.clientPhone, `Olá, ${entry.clientName}! Sobre sua lista de espera no Yas Femme Studio.`))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>
        <button class="button button-primary" data-waitlist-id="${entry.id}" data-waitlist-status="contacted" ${entry.status === "contacted" ? "disabled" : ""}>Contatada</button>
        <button class="button button-soft" data-waitlist-id="${entry.id}" data-waitlist-status="closed" ${entry.status === "closed" ? "disabled" : ""}>Encerrar</button>
      </div>
    </article>
  `;
}

function renderServicesList() {
  const list = document.getElementById("servicesList");
  if (!adminState.services.length) {
    list.innerHTML = "<p class=\"empty-state\">Nenhum serviço cadastrado.</p>";
    return;
  }

  list.innerHTML = adminState.services.map((service) => `
    <article class="admin-param-card">
      <img src="${escapeAttribute(service.image)}" alt="${escapeAttribute(service.name)}">
      <div>
        <span class="status-pill ${service.active ? "status-confirmed" : "status-cancelled"}">${service.active ? "Ativo" : "Inativo"}</span>
        ${service.featured ? "<span class=\"status-pill status-pending\">Destaque</span>" : ""}
        <h3>${escapeHtml(service.name)}</h3>
        <p>${escapeHtml(service.priceText)} | Ordem ${escapeHtml(service.sortOrder)}</p>
      </div>
      <div class="admin-card-actions">
        <button class="button button-dark" type="button" data-edit-service="${escapeAttribute(service.id)}">Editar</button>
        <button class="button button-soft" type="button" data-toggle-service="${escapeAttribute(service.id)}">${service.active ? "Desativar" : "Ativar"}</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-edit-service]").forEach((button) => {
    button.addEventListener("click", () => editService(button.dataset.editService));
  });
  list.querySelectorAll("[data-toggle-service]").forEach((button) => {
    button.addEventListener("click", () => toggleService(button.dataset.toggleService));
  });
}

function renderPostsList() {
  const list = document.getElementById("postsList");
  if (!adminState.posts.length) {
    list.innerHTML = "<p class=\"empty-state\">Nenhuma publicação cadastrada.</p>";
    return;
  }

  list.innerHTML = adminState.posts.map((post) => `
    <article class="admin-param-card">
      ${post.image ? `<img src="${escapeAttribute(post.image)}" alt="${escapeAttribute(post.title)}">` : "<div class=\"admin-thumb-placeholder\"></div>"}
      <div>
        <span class="status-pill ${post.active ? "status-confirmed" : "status-cancelled"}">${post.active ? "Ativa" : "Inativa"}</span>
        ${post.featured ? "<span class=\"status-pill status-pending\">Destaque</span>" : ""}
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.body)}</p>
      </div>
      <div class="admin-card-actions">
        <button class="button button-dark" type="button" data-edit-post="${post.id}">Editar</button>
        <button class="button button-soft" type="button" data-toggle-post="${post.id}">${post.active ? "Desativar" : "Ativar"}</button>
      </div>
    </article>
  `).join("");

  list.querySelectorAll("[data-edit-post]").forEach((button) => {
    button.addEventListener("click", () => editPost(Number(button.dataset.editPost)));
  });
  list.querySelectorAll("[data-toggle-post]").forEach((button) => {
    button.addEventListener("click", () => togglePost(Number(button.dataset.togglePost)));
  });
}

function renderHoursEditor() {
  const editor = document.getElementById("hoursEditor");
  const byDay = new Map(adminState.businessHours.map((day) => [Number(day.dayOfWeek), day]));
  editor.innerHTML = dayNames.map((name, dayOfWeek) => {
    const day = byDay.get(dayOfWeek) || { dayOfWeek, isOpen: false, times: [] };
    return `
      <div class="hour-row" data-day="${dayOfWeek}">
        <label class="hour-open">
          <input class="hours-open" type="checkbox" ${day.isOpen ? "checked" : ""}>
          ${escapeHtml(name)}
        </label>
        <input class="hours-times" value="${escapeAttribute((day.times || []).join(", "))}" placeholder="19:00, 21:00">
      </div>
    `;
  }).join("");
}

function populateSettingsForms() {
  const settings = adminState.settings || {};
  const contact = settings.contact || {};
  const location = settings.location || {};
  const payments = settings.payments || {};
  const site = settings.site || {};
  const hero = settings.hero || {};

  setValue("contactWhatsapp", contact.whatsappNumber);
  setValue("contactInstagram", contact.instagramUrl);
  setValue("contactPublicBaseUrl", contact.publicBaseUrl);
  setValue("contactPixKey", contact.pixKey);
  setValue("locationLine1Input", location.line1);
  setValue("locationLine2Input", location.line2);
  setValue("locationReferenceInput", location.reference);
  setValue("locationMapsUrl", location.mapsUrl);
  setValue("locationMapEmbedUrl", location.mapEmbedUrl);

  document.getElementById("paymentPix").checked = Boolean(payments.pix);
  document.getElementById("paymentCash").checked = Boolean(payments.cash);
  setValue("paymentDebit", listToText(payments.debit));
  setValue("paymentCredit", listToText(payments.credit));
  setValue("paymentVouchers", listToText(payments.vouchers));

  setValue("siteBrandName", site.brandName);
  setValue("siteFooterText", site.footerText);
  setValue("siteBookingMaxDays", site.bookingMaxDays);
  setValue("heroEyebrowInput", hero.eyebrow);
  setValue("heroTitleInput", hero.title);
  setValue("heroCopyInput", hero.copy);
}

async function updateBooking(id, status) {
  await adminApi(`/api/admin/bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await Promise.all([loadBookings(), loadAgenda()]);
  showNotice("Reserva atualizada.");
}

async function updateWaitlist(id, status) {
  await adminApi(`/api/admin/waitlist/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await loadWaitlist();
  showNotice("Lista de espera atualizada.");
}

async function submitService(event) {
  event.preventDefault();
  try {
    let image = document.getElementById("serviceImage").value.trim();
    const file = document.getElementById("serviceImageFile").files[0];
    if (file) image = await uploadFile(file);

    const id = document.getElementById("serviceId").value;
    const payload = {
      name: document.getElementById("serviceName").value,
      image,
      applicationPrice: toNumber("serviceApplicationPrice"),
      maintenancePrice: optionalNumber("serviceMaintenancePrice"),
      priceText: document.getElementById("servicePriceText").value,
      maintenanceLabel: document.getElementById("serviceMaintenanceLabel").value,
      description: document.getElementById("serviceDescription").value,
      durationMinutes: toNumber("serviceDuration"),
      sortOrder: toNumber("serviceSortOrder"),
      featured: document.getElementById("serviceFeatured").checked,
      active: document.getElementById("serviceActive").checked
    };

    await adminApi(id ? `/api/admin/services/${encodeURIComponent(id)}` : "/api/admin/services", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    await loadServices();
    resetServiceForm();
    showNotice("Serviço salvo.");
  } catch (error) {
    showNotice(error.message, true);
  }
}

function editService(id) {
  const service = adminState.services.find((item) => item.id === id);
  if (!service) return;
  setValue("serviceId", service.id);
  setValue("serviceName", service.name);
  setValue("serviceImage", service.image);
  setValue("serviceApplicationPrice", service.applicationPrice);
  setValue("serviceMaintenancePrice", service.maintenancePrice || "");
  setValue("servicePriceText", service.priceText);
  setValue("serviceMaintenanceLabel", service.maintenanceLabel);
  setValue("serviceDescription", service.description);
  setValue("serviceDuration", service.durationMinutes);
  setValue("serviceSortOrder", service.sortOrder);
  document.getElementById("serviceFeatured").checked = service.featured;
  document.getElementById("serviceActive").checked = service.active;
  document.getElementById("serviceImageFile").value = "";
  activateTab("catalog");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function toggleService(id) {
  const service = adminState.services.find((item) => item.id === id);
  if (!service) return;
  await adminApi(`/api/admin/services/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ active: !service.active })
  });
  await loadServices();
  showNotice(service.active ? "Serviço desativado." : "Serviço ativado.");
}

function resetServiceForm() {
  document.getElementById("serviceForm").reset();
  setValue("serviceId", "");
  setValue("serviceDuration", 120);
  setValue("serviceSortOrder", 100);
  document.getElementById("serviceActive").checked = true;
}

async function submitPost(event) {
  event.preventDefault();
  try {
    let image = document.getElementById("postImage").value.trim();
    const file = document.getElementById("postImageFile").files[0];
    if (file) image = await uploadFile(file);

    const id = document.getElementById("postId").value;
    const payload = {
      title: document.getElementById("postTitle").value,
      body: document.getElementById("postBody").value,
      image,
      ctaLabel: document.getElementById("postCtaLabel").value,
      ctaUrl: document.getElementById("postCtaUrl").value,
      sortOrder: toNumber("postSortOrder"),
      featured: document.getElementById("postFeatured").checked,
      active: document.getElementById("postActive").checked
    };

    await adminApi(id ? `/api/admin/posts/${id}` : "/api/admin/posts", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload)
    });
    await loadPosts();
    resetPostForm();
    showNotice("Publicação salva.");
  } catch (error) {
    showNotice(error.message, true);
  }
}

function editPost(id) {
  const post = adminState.posts.find((item) => item.id === id);
  if (!post) return;
  setValue("postId", post.id);
  setValue("postTitle", post.title);
  setValue("postBody", post.body);
  setValue("postImage", post.image);
  setValue("postCtaLabel", post.ctaLabel);
  setValue("postCtaUrl", post.ctaUrl);
  setValue("postSortOrder", post.sortOrder);
  document.getElementById("postFeatured").checked = post.featured;
  document.getElementById("postActive").checked = post.active;
  document.getElementById("postImageFile").value = "";
  activateTab("posts");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function togglePost(id) {
  const post = adminState.posts.find((item) => item.id === id);
  if (!post) return;
  await adminApi(`/api/admin/posts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ active: !post.active })
  });
  await loadPosts();
  showNotice(post.active ? "Publicação desativada." : "Publicação ativada.");
}

function resetPostForm() {
  document.getElementById("postForm").reset();
  setValue("postId", "");
  setValue("postSortOrder", 100);
  document.getElementById("postActive").checked = true;
}

async function submitBusinessHours(event) {
  event.preventDefault();
  const days = Array.from(document.querySelectorAll(".hour-row")).map((row) => ({
    dayOfWeek: Number(row.dataset.day),
    isOpen: row.querySelector(".hours-open").checked,
    times: row.querySelector(".hours-times").value
  }));
  const data = await adminApi("/api/admin/business-hours", {
    method: "PATCH",
    body: JSON.stringify({ days })
  });
  adminState.businessHours = data.businessHours || [];
  renderHoursEditor();
  showNotice("Horários salvos.");
}

async function submitContactSettings(event) {
  event.preventDefault();
  await saveSettings({
    contact: {
      whatsappNumber: getValue("contactWhatsapp"),
      instagramUrl: getValue("contactInstagram"),
      publicBaseUrl: getValue("contactPublicBaseUrl"),
      pixKey: getValue("contactPixKey")
    },
    location: {
      line1: getValue("locationLine1Input"),
      line2: getValue("locationLine2Input"),
      reference: getValue("locationReferenceInput"),
      mapsUrl: getValue("locationMapsUrl"),
      mapEmbedUrl: getValue("locationMapEmbedUrl")
    }
  }, "Contatos salvos.");
}

async function submitPaymentSettings(event) {
  event.preventDefault();
  await saveSettings({
    payments: {
      pix: document.getElementById("paymentPix").checked,
      cash: document.getElementById("paymentCash").checked,
      debit: textToList(getValue("paymentDebit")),
      credit: textToList(getValue("paymentCredit")),
      vouchers: textToList(getValue("paymentVouchers"))
    }
  }, "Pagamentos salvos.");
}

async function submitSiteSettings(event) {
  event.preventDefault();
  await saveSettings({
    site: {
      brandName: getValue("siteBrandName"),
      footerText: getValue("siteFooterText"),
      bookingMaxDays: toNumber("siteBookingMaxDays")
    },
    hero: {
      eyebrow: getValue("heroEyebrowInput"),
      title: getValue("heroTitleInput"),
      copy: getValue("heroCopyInput")
    }
  }, "Textos do site salvos.");
}

async function saveSettings(patch, message) {
  try {
    const data = await adminApi("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    adminState.settings = data.settings || {};
    populateSettingsForms();
    showNotice(message);
  } catch (error) {
    showNotice(error.message, true);
  }
}

async function uploadFile(file) {
  const dataUrl = await readFileAsDataUrl(file);
  const data = await adminApi("/api/admin/uploads", {
    method: "POST",
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      data: dataUrl
    })
  });
  return data.url;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

function activateTab(tab) {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === tab);
  });
  document.querySelectorAll("[data-admin-tab-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.adminTabPanel !== tab;
  });
}

function showDashboard() {
  document.getElementById("loginPanel").hidden = true;
  document.getElementById("adminDashboard").hidden = false;
}

function showLogin() {
  document.getElementById("loginPanel").hidden = false;
  document.getElementById("adminDashboard").hidden = true;
}

function clientWhatsapp(phone, message) {
  const digits = String(phone || "").replace(/\D/g, "");
  const normalized = digits.length === 11 ? `55${digits}` : digits;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function showNotice(message, isError = false) {
  const notice = document.getElementById("adminNotice");
  notice.textContent = message || "";
  notice.classList.toggle("is-error", Boolean(isError));
}

function setValue(id, value) {
  const input = document.getElementById(id);
  if (input) input.value = value === null || value === undefined ? "" : value;
}

function getValue(id) {
  const input = document.getElementById(id);
  return input ? input.value.trim() : "";
}

function toNumber(id) {
  return Math.max(0, Math.round(Number(getValue(id)) || 0));
}

function optionalNumber(id) {
  const value = getValue(id);
  return value === "" ? null : Math.max(0, Math.round(Number(value) || 0));
}

function textToList(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function listToText(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function getAgendaRange() {
  if (adminState.agendaView === "week") {
    const start = startOfWeek(adminState.agendaCursor);
    return {
      from: formatDateISO(start),
      to: formatDateISO(addDays(start, 6))
    };
  }

  const start = startOfMonth(adminState.agendaCursor);
  return {
    from: formatDateISO(start),
    to: formatDateISO(endOfMonth(start))
  };
}

function getAgendaRangeLabel(from, to) {
  if (adminState.agendaView === "week") {
    return `${formatDateBR(from)} a ${formatDateBR(to)}`;
  }
  const cursor = adminState.agendaCursor;
  return `${monthNames[cursor.getMonth()]} ${cursor.getFullYear()}`;
}

function groupBookingsByDate(bookings) {
  const groups = new Map();
  for (const booking of bookings) {
    if (!groups.has(booking.date)) groups.set(booking.date, []);
    groups.get(booking.date).push(booking);
  }
  return groups;
}

function groupBookingsBySlot(bookings) {
  const groups = new Map();
  for (const booking of bookings) {
    const key = `${booking.date}|${booking.time}`;
    if (!groups.has(key) || booking.status !== "cancelled") {
      groups.set(key, booking);
    }
  }
  return groups;
}

function isDateInRange(dateString, from, to) {
  return dateString >= from && dateString <= to;
}

function formatDateISO(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function parseDateOnly(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function formatDateBR(value) {
  const [year, month, day] = String(value || "").split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
