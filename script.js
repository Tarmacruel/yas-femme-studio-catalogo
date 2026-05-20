const state = {
  settings: {},
  services: [],
  posts: [],
  businessHours: [],
  contact: {},
  availability: null,
  availabilityMap: new Map(),
  currentMonthDate: startOfMonth(new Date()),
  selectedService: null,
  selectedDate: null,
  selectedTime: null
};

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const dayNames = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
];

document.addEventListener("DOMContentLoaded", async () => {
  bindStaticEvents();
  setupPhoneMask("clientPhone");
  setupPhoneMask("waitlistPhone");
  setupMaintenanceDate();

  try {
    await loadSite();
    await refreshSummaryAvailability();
    await loadCalendarAvailability();
    renderCalendar();
  } catch (error) {
    console.error(error);
    document.getElementById("servicesGrid").innerHTML = "<p>Não foi possível carregar o catálogo agora.</p>";
  }
});

function bindStaticEvents() {
  document.getElementById("prevMonthButton").addEventListener("click", async () => {
    state.currentMonthDate.setMonth(state.currentMonthDate.getMonth() - 1);
    await loadCalendarAvailability();
    renderCalendar();
  });

  document.getElementById("nextMonthButton").addEventListener("click", async () => {
    state.currentMonthDate.setMonth(state.currentMonthDate.getMonth() + 1);
    await loadCalendarAvailability();
    renderCalendar();
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeBookingModal));
  document.querySelectorAll("[data-close-waitlist]").forEach((button) => button.addEventListener("click", closeWaitlistModal));
  document.getElementById("bookingModal").addEventListener("click", (event) => {
    if (event.target.id === "bookingModal") closeBookingModal();
  });
  document.getElementById("waitlistModal").addEventListener("click", (event) => {
    if (event.target.id === "waitlistModal") closeWaitlistModal();
  });

  document.getElementById("bookingForm").addEventListener("submit", submitBooking);
  document.getElementById("waitlistForm").addEventListener("submit", submitWaitlist);
  document.getElementById("waitlistFromBooking").addEventListener("click", openWaitlistModal);
  document.getElementById("maintenanceForm").addEventListener("submit", calculateMaintenance);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Falha na comunicação com o servidor.");
  }
  return data;
}

async function loadSite() {
  const data = await api("/api/site");
  state.settings = data.settings || {};
  state.services = data.services || [];
  state.posts = data.posts || [];
  state.businessHours = data.businessHours || [];
  state.contact = data.contact || state.settings.contact || {};

  renderSiteChrome();
  renderServices();
  renderPosts();
  renderPayments();
  renderBusinessHours();
  renderMaintenanceOptions();
  updateWhatsappLinks();
}

function renderSiteChrome() {
  const site = state.settings.site || {};
  const hero = state.settings.hero || {};
  const location = state.settings.location || {};

  setText("brandName", site.brandName || "Yas Femme Studio");
  setText("heroEyebrow", hero.eyebrow || "Studio de estética");
  setText("heroTitle", hero.title || site.brandName || "Yas Femme Studio");
  setText("heroCopy", hero.copy || "Design de cílios com agenda online e confirmação pelo WhatsApp.");
  setText("footerText", site.footerText || "Yas Femme Studio - Catálogo e agenda local.");
  setText("locationLine1", location.line1 || "");
  setText("locationLine2", location.line2 || "");
  setText("locationReference", location.reference || "");

  setHref("instagramLink", state.contact.instagramUrl || "#");
  setHref("mapsLink", location.mapsUrl || "#");
  const mapFrame = document.getElementById("mapFrame");
  if (mapFrame && location.mapEmbedUrl) {
    mapFrame.src = location.mapEmbedUrl;
  }

  document.title = `${site.brandName || "Yas Femme Studio"} - Catálogo e Agenda`;
}

function renderServices() {
  const grid = document.getElementById("servicesGrid");
  if (!state.services.length) {
    grid.innerHTML = "<p>Nenhum serviço ativo no momento.</p>";
    return;
  }

  grid.innerHTML = state.services.map((service) => `
    <article class="service-card ${service.featured ? "featured" : ""}">
      <div class="service-media">
        <img src="${escapeAttribute(service.image)}" alt="${escapeAttribute(service.name)}">
      </div>
      <div class="service-body">
        <span class="service-tag">${escapeHtml(service.featured ? "Destaque" : service.maintenanceLabel)}</span>
        <h3>${escapeHtml(service.name)}</h3>
        <p>${escapeHtml(service.description)}</p>
        <span class="service-price">${escapeHtml(service.priceText)}</span>
        <button class="button button-primary" type="button" data-book-service="${escapeAttribute(service.id)}">Solicitar horário</button>
      </div>
    </article>
  `).join("");

  grid.querySelectorAll("[data-book-service]").forEach((button) => {
    button.addEventListener("click", () => openBookingModal(button.dataset.bookService));
  });

  requestAnimationFrame(() => {
    document.querySelectorAll(".service-card").forEach((card, index) => {
      setTimeout(() => card.classList.add("active"), index * 70);
    });
  });
}

function renderPosts() {
  const section = document.getElementById("feed");
  const grid = document.getElementById("feedGrid");
  if (!state.posts.length) {
    section.hidden = true;
    grid.innerHTML = "";
    return;
  }

  section.hidden = false;
  grid.innerHTML = state.posts.map((post) => `
    <article class="feed-card ${post.featured ? "featured" : ""}">
      ${post.image ? `
        <div class="feed-media">
          <img src="${escapeAttribute(post.image)}" alt="${escapeAttribute(post.title)}">
        </div>
      ` : ""}
      <div class="feed-body">
        <span>${post.featured ? "Em destaque" : "Novidade"}</span>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.body)}</p>
        ${post.ctaLabel && post.ctaUrl ? `<a class="button button-soft" href="${escapeAttribute(post.ctaUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.ctaLabel)}</a>` : ""}
      </div>
    </article>
  `).join("");
}

function renderPayments() {
  const payments = (state.settings && state.settings.payments) || {};
  const grid = document.getElementById("paymentGrid");
  const groups = [];

  if (payments.pix) {
    const pixKey = state.contact.pixKey || "";
    groups.push(`
      <article class="plain-panel payment-card">
        <h3>PIX</h3>
        <p>Chave para sinal ou pagamento combinado.</p>
        <div class="copy-row">
          <input id="pixKey" value="${escapeAttribute(pixKey)}" readonly>
          <button class="button button-dark" id="copyPixButton" type="button">Copiar</button>
        </div>
      </article>
    `);
  }

  if (payments.cash) {
    groups.push(`
      <article class="plain-panel payment-card">
        <h3>Dinheiro</h3>
        <p>Pagamento em espécie disponível no studio.</p>
      </article>
    `);
  }

  groups.push(renderPaymentList("Débito", payments.debit));
  groups.push(renderPaymentList("Crédito", payments.credit));
  groups.push(renderPaymentList("Vouchers e vales", payments.vouchers));

  grid.innerHTML = groups.filter(Boolean).join("");
  const copyButton = document.getElementById("copyPixButton");
  if (copyButton) copyButton.addEventListener("click", copyPixKey);
}

function renderPaymentList(title, items = []) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return "";
  return `
    <article class="plain-panel payment-card">
      <h3>${escapeHtml(title)}</h3>
      <ul class="tag-list">
        ${list.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderBusinessHours() {
  const list = document.getElementById("hoursList");
  list.innerHTML = state.businessHours.map((day) => `
    <span><strong>${dayNames[day.dayOfWeek] || "Dia"}</strong>: ${day.isOpen && day.times.length ? escapeHtml(day.times.join(", ")) : "Fechado"}</span>
  `).join("");
}

async function refreshSummaryAvailability() {
  const today = new Date();
  const end = addDays(today, 6);
  const data = await api(`/api/availability?from=${formatDateISO(today)}&to=${formatDateISO(end)}`);
  document.getElementById("nextSlotText").textContent = data.nextAvailable
    ? `${formatDateBR(data.nextAvailable.date)} às ${data.nextAvailable.time}`
    : "Sem horário livre";
  document.getElementById("weeklySlotsText").textContent = `${data.availableSlots} de ${data.totalSlots} horários livres`;
  document.getElementById("urgencyAlert").textContent = data.availableSlots > 0
    ? "Solicitações entram como pendentes até a confirmação da studio."
    : "A lista de espera fica disponível quando a agenda estiver cheia.";
}

async function loadCalendarAvailability() {
  const start = startOfMonth(state.currentMonthDate);
  const end = endOfMonth(state.currentMonthDate);
  state.availability = await api(`/api/availability?from=${formatDateISO(start)}&to=${formatDateISO(end)}`);
  state.availabilityMap = new Map(state.availability.days.map((day) => [day.date, day]));
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const title = document.getElementById("currentMonth");
  const monthDate = state.currentMonthDate;
  const first = startOfMonth(monthDate);
  const last = endOfMonth(monthDate);

  title.textContent = `${monthNames[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  grid.innerHTML = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    .map((day) => `<div class="calendar-weekday">${day}</div>`)
    .join("");

  for (let i = 0; i < first.getDay(); i += 1) {
    grid.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= last.getDate(); day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
    const dateString = formatDateISO(date);
    const availability = state.availabilityMap.get(dateString);
    const availableCount = availability ? availability.slots.filter((slot) => slot.available).length : 0;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = String(day);
    button.disabled = availableCount === 0;
    if (state.selectedDate === dateString) button.classList.add("selected");
    button.addEventListener("click", () => selectDate(dateString));
    grid.appendChild(button);
  }

  renderTimeSlots();
}

function selectDate(dateString) {
  state.selectedDate = dateString;
  state.selectedTime = null;
  renderCalendar();
}

function renderTimeSlots() {
  const panel = document.getElementById("slotPanel");
  const grid = document.getElementById("timeGrid");
  const waitlistButton = document.getElementById("waitlistFromBooking");

  if (!state.selectedDate) {
    panel.hidden = true;
    updateBookingSummary();
    return;
  }

  const day = state.availabilityMap.get(state.selectedDate);
  const slots = day ? day.slots : [];
  const availableSlots = slots.filter((slot) => slot.available);
  panel.hidden = false;
  waitlistButton.hidden = availableSlots.length > 0;

  grid.innerHTML = slots.length
    ? slots.map((slot) => `
      <button class="time-slot ${state.selectedTime === slot.time ? "selected" : ""}" type="button" data-time="${slot.time}" ${slot.available ? "" : "disabled"}>
        ${escapeHtml(slot.time)}
      </button>
    `).join("")
    : "<p class=\"muted\">Não há horários para esta data.</p>";

  grid.querySelectorAll("[data-time]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTime = button.dataset.time;
      renderTimeSlots();
    });
  });

  updateBookingSummary();
}

function openBookingModal(serviceId) {
  state.selectedService = state.services.find((service) => service.id === serviceId);
  if (!state.selectedService) return;
  state.selectedDate = null;
  state.selectedTime = null;
  document.getElementById("bookingServiceLabel").textContent = state.selectedService.name;
  document.getElementById("bookingForm").reset();
  document.getElementById("bookingError").textContent = "";
  document.getElementById("bookingFormShell").hidden = false;
  document.getElementById("bookingSuccess").hidden = true;
  document.getElementById("bookingModal").hidden = false;
  document.body.classList.add("modal-open");
  renderCalendar();
}

function closeBookingModal() {
  document.getElementById("bookingModal").hidden = true;
  document.body.classList.remove("modal-open");
}

function updateBookingSummary() {
  const summary = document.getElementById("bookingSummary");
  const confirm = document.getElementById("confirmBookingButton");
  if (!state.selectedService || !state.selectedDate || !state.selectedTime) {
    summary.hidden = true;
    confirm.disabled = true;
    return;
  }

  summary.hidden = false;
  summary.innerHTML = `
    <strong>Resumo</strong>
    <p>${escapeHtml(state.selectedService.name)} - ${escapeHtml(state.selectedService.priceText)}</p>
    <p>${formatDateBR(state.selectedDate)} às ${escapeHtml(state.selectedTime)}</p>
  `;
  confirm.disabled = false;
}

async function submitBooking(event) {
  event.preventDefault();
  const error = document.getElementById("bookingError");
  const button = document.getElementById("confirmBookingButton");
  error.textContent = "";
  button.disabled = true;

  try {
    const data = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        serviceId: state.selectedService.id,
        clientName: document.getElementById("clientName").value,
        clientPhone: document.getElementById("clientPhone").value,
        clientAddress: document.getElementById("clientAddress").value,
        notes: document.getElementById("bookingNotes").value,
        date: state.selectedDate,
        time: state.selectedTime
      })
    });

    document.getElementById("bookingFormShell").hidden = true;
    const success = document.getElementById("bookingSuccess");
    success.hidden = false;
    success.innerHTML = `
      <h2>Solicitação enviada</h2>
      <p>O horário ficou bloqueado como pendente. A confirmação final será feita pelo WhatsApp.</p>
      <p><strong>${escapeHtml(data.booking.serviceName)}</strong><br>${formatDateBR(data.booking.date)} às ${escapeHtml(data.booking.time)}</p>
      <div class="result-actions">
        <a class="button button-primary" href="${escapeAttribute(data.whatsappUrl)}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
        <button class="button button-soft" type="button" data-close-success>Fechar</button>
      </div>
    `;
    success.querySelector("[data-close-success]").addEventListener("click", closeBookingModal);
    window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
    await refreshSummaryAvailability();
    await loadCalendarAvailability();
  } catch (apiError) {
    error.textContent = apiError.message;
    await loadCalendarAvailability();
    renderCalendar();
  } finally {
    button.disabled = false;
  }
}

function openWaitlistModal() {
  document.getElementById("waitlistForm").reset();
  document.getElementById("waitlistError").textContent = "";
  document.getElementById("waitlistFormShell").hidden = false;
  document.getElementById("waitlistSuccess").hidden = true;
  document.getElementById("waitlistModal").hidden = false;
  document.body.classList.add("modal-open");
}

function closeWaitlistModal() {
  document.getElementById("waitlistModal").hidden = true;
  document.body.classList.remove("modal-open");
}

async function submitWaitlist(event) {
  event.preventDefault();
  const error = document.getElementById("waitlistError");
  error.textContent = "";
  try {
    const data = await api("/api/waitlist", {
      method: "POST",
      body: JSON.stringify({
        serviceId: state.selectedService ? state.selectedService.id : "",
        clientName: document.getElementById("waitlistName").value,
        clientPhone: document.getElementById("waitlistPhone").value,
        preferredDate: state.selectedDate || "",
        period: document.getElementById("waitlistPeriod").value,
        notes: document.getElementById("waitlistNotes").value
      })
    });

    document.getElementById("waitlistFormShell").hidden = true;
    const success = document.getElementById("waitlistSuccess");
    success.hidden = false;
    success.innerHTML = `
      <h2>Você entrou na lista</h2>
      <p>A studio recebeu sua preferência e poderá chamar quando houver encaixe.</p>
      <a class="button button-primary" href="${escapeAttribute(data.whatsappUrl)}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>
    `;
    window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
  } catch (apiError) {
    error.textContent = apiError.message;
  }
}

function renderMaintenanceOptions() {
  const select = document.getElementById("maintenanceService");
  select.innerHTML = `<option value="">Selecione...</option>${state.services.map((service) => `
    <option value="${escapeAttribute(service.id)}">${escapeHtml(service.name)} (${escapeHtml(service.maintenanceLabel)})</option>
  `).join("")}`;
}

function calculateMaintenance(event) {
  event.preventDefault();
  const service = state.services.find((item) => item.id === document.getElementById("maintenanceService").value);
  const dateValue = document.getElementById("maintenanceDate").value;
  const result = document.getElementById("maintenanceResult");
  if (!service || !dateValue) return;

  if (!service.maintenancePrice) {
    result.hidden = false;
    result.innerHTML = `<strong>${escapeHtml(service.name)}</strong><p>Esta técnica não tem manutenção programada. O retorno pode ser combinado quando você quiser renovar o efeito.</p>`;
    return;
  }

  const applicationDate = parseDateOnly(dateValue);
  const start = addDays(applicationDate, 15);
  const end = addDays(applicationDate, 20);
  result.hidden = false;
  result.innerHTML = `
    <strong>${escapeHtml(service.name)}</strong>
    <p>O período ideal de manutenção fica entre ${formatDateBR(formatDateISO(start))} e ${formatDateBR(formatDateISO(end))}.</p>
    <a class="button button-dark" href="${escapeAttribute(buildWhatsappUrl(`Olá! Gostaria de agendar manutenção de ${service.name}.`))}" target="_blank" rel="noopener noreferrer">Agendar manutenção</a>
  `;
}

function setupMaintenanceDate() {
  document.getElementById("maintenanceDate").max = formatDateISO(new Date());
}

function updateWhatsappLinks() {
  const url = buildWhatsappUrl("Olá! Gostaria de informações sobre os serviços do Yas Femme Studio.");
  setHref("heroWhatsapp", url);
  setHref("floatingWhatsapp", url);
}

function buildWhatsappUrl(message) {
  return `https://wa.me/${state.contact.whatsappNumber || "557381676132"}?text=${encodeURIComponent(message)}`;
}

function copyPixKey() {
  const input = document.getElementById("pixKey");
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(() => {
    const button = document.getElementById("copyPixButton");
    const original = button.textContent;
    button.textContent = "Copiado";
    setTimeout(() => { button.textContent = original; }, 1600);
  });
}

function setupPhoneMask(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener("input", () => {
    let value = input.value.replace(/\D/g, "").slice(0, 11);
    value = value.replace(/^(\d{2})(\d)/, "($1) $2");
    value = value.replace(/(\d)(\d{4})$/, "$1-$2");
    input.value = value;
  });
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setHref(id, value) {
  const element = document.getElementById(id);
  if (element) element.href = value || "#";
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

function formatDateISO(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function parseDateOnly(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateBR(value) {
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
