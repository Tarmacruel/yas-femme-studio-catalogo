// ==========================================
// YAS FEMME STUDIO - SISTEMA PREMIUM
// ==========================================

const WHATSAPP_NUMBER = "557381676132";
const DURATION_HOURS = 2;

// Estado do Calendário
let currentDate = new Date();
let selectedDate = null;
let selectedTime = null;
let currentService = null;
let currentPrice = null;

// ==========================================
// FUNÇÕES GERAIS
// ==========================================

function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatRelativeDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    
    if (dateToCheck.getTime() === today.getTime()) return "Hoje";
    if (dateToCheck.getTime() === tomorrow.getTime()) return "Amanhã";
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
}

function formatDateBR(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function daysDifference(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    const d1 = new Date(date1 + 'T00:00:00');
    const d2 = new Date(date2 + 'T00:00:00');
    return Math.round((d2 - d1) / oneDay);
}

// ==========================================
// MÁSCARA DE TELEFONE
// ==========================================

function setupPhoneMask(inputId) {
    const phoneInput = document.getElementById(inputId);
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length <= 11) {
                value = value.replace(/^(\d{2})(\d)/g, '($1) $2');
                value = value.replace(/(\d)(\d{4})$/, '$1-$2');
                e.target.value = value;
            }
        });
    }
}

// ==========================================
// SCROLL REVEAL
// ==========================================

function setupScrollReveal() {
    const reveals = document.querySelectorAll('.service-card');
    if (reveals.length === 0) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal', 'active');
            }
        });
    }, { threshold: 0.1 });
    
    reveals.forEach(card => observer.observe(card));
}

// ==========================================
// SISTEMA DE URGÊNCIA
// ==========================================

function updateUrgencyIndicators() {
    const nextSlotElement = document.getElementById('nextSlotText');
    const weeklySlotsElement = document.getElementById('weeklySlotsText');
    const weeklyBadge = document.getElementById('weeklyAvailability');
    const alertElement = document.getElementById('urgencyAlert');
    
    if (!nextSlotElement || !weeklySlotsElement) return;
    
    const appointments = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextAvailable = findNextAvailableSlot(appointments, today);
    const weeklySlots = countWeeklyAvailableSlots(appointments, today);
    
    if (nextAvailable) {
        nextSlotElement.textContent = `${formatRelativeDate(nextAvailable.date)} às ${nextAvailable.time}`;
    } else {
        nextSlotElement.textContent = "Sem horários disponíveis";
        nextSlotElement.style.color = "#ff6b6b";
    }
    
    weeklySlotsElement.textContent = `${weeklySlots.available} de ${weeklySlots.total} horários`;
    weeklyBadge.classList.remove('high-availability', 'medium-availability', 'low-availability');
    
    const percentage = weeklySlots.total > 0 ? (weeklySlots.available / weeklySlots.total) * 100 : 0;
    if (percentage > 60) weeklyBadge.classList.add('high-availability');
    else if (percentage > 30) weeklyBadge.classList.add('medium-availability');
    else weeklyBadge.classList.add('low-availability');
    
    if (weeklySlots.available <= 3 && weeklySlots.available > 0) {
        alertElement.innerHTML = `<span class="alert-icon">🔥</span><span class="alert-text">Últimos ${weeklySlots.available} horários esta semana!</span>`;
        alertElement.style.display = 'flex';
    } else if (weeklySlots.available <= 5 && weeklySlots.available > 0) {
        alertElement.innerHTML = `<span class="alert-icon">⚡</span><span class="alert-text">Corra! Apenas ${weeklySlots.available} horários!</span>`;
        alertElement.style.display = 'flex';
    } else {
        alertElement.style.display = 'none';
    }
}

function findNextAvailableSlot(appointments, startDate) {
    for (let day = 0; day < 60; day++) {
        const checkDate = new Date(startDate);
        checkDate.setDate(startDate.getDate() + day);
        if (checkDate.getDay() === 0) continue;
        
        const isSaturday = checkDate.getDay() === 6;
        let times = isSaturday ? ['09:00','11:00','13:00','15:00','17:00','19:00','21:00'] : ['19:00','21:00'];
        
        const today = new Date(); today.setHours(0,0,0,0);
        if (checkDate.getTime() === today.getTime()) {
            const currentHour = new Date().getHours();
            times = times.filter(time => parseInt(time) > currentHour);
        }
        
        const dateStr = formatDateISO(checkDate);
        for (const time of times) {
            if (!appointments.some(app => app.date === dateStr && app.time === time)) {
                return { date: checkDate, time: time };
            }
        }
    }
    return null;
}

function countWeeklyAvailableSlots(appointments, startDate) {
    const nextMonday = new Date(startDate);
    const daysUntilMonday = startDate.getDay() === 0 ? 1 : (8 - startDate.getDay());
    nextMonday.setDate(startDate.getDate() + daysUntilMonday);
    nextMonday.setHours(0,0,0,0);
    
    const saturday = new Date(nextMonday);
    saturday.setDate(nextMonday.getDate() + 5);
    
    let total = 0, available = 0;
    
    for (let d = new Date(nextMonday); d <= saturday; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 0) continue;
        const isSat = d.getDay() === 6;
        let times = isSat ? ['09:00','11:00','13:00','15:00','17:00','19:00','21:00'] : ['19:00','21:00'];
        
        const today = new Date(); today.setHours(0,0,0,0);
        if (d.getTime() === today.getTime()) {
            const h = new Date().getHours();
            times = times.filter(t => parseInt(t) > h);
        }
        
        total += times.length;
        const dateStr = formatDateISO(d);
        available += times.filter(t => !appointments.some(a => a.date === dateStr && a.time === t)).length;
    }
    return { total, available };
}

// ==========================================
// CALENDÁRIO
// ==========================================

function renderCalendar() {
    const year = currentDate.getFullYear(), month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(day => {
        const h = document.createElement('div');
        h.className = 'calendar-day-header';
        h.textContent = day;
        grid.appendChild(h);
    });
    
    const today = new Date(); today.setHours(0,0,0,0);
    const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 60);
    
    for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.textContent = day;
        
        if (date.getDay() === 0) cell.classList.add('sunday','disabled');
        else if (date < today || date > maxDate) cell.classList.add('disabled');
        else cell.addEventListener('click', () => selectDate(date, cell));
        
        if (selectedDate && date.toDateString() === selectedDate.toDateString()) cell.classList.add('selected');
        grid.appendChild(cell);
    }
}

function changeMonth(delta) { currentDate.setMonth(currentDate.getMonth() + delta); renderCalendar(); }

function selectDate(date, cell) {
    document.querySelectorAll('.calendar-day').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    selectedDate = date; selectedTime = null;
    renderTimeSlots(); updateSummary();
}

function renderTimeSlots() {
    if (!selectedDate) return;
    const container = document.getElementById('timeSlotsContainer');
    const grid = document.getElementById('timeGrid');
    if (!container || !grid) return;
    
    container.style.display = 'block';
    grid.innerHTML = '';
    
    const isSat = selectedDate.getDay() === 6;
    let times = isSat ? ['09:00','11:00','13:00','15:00','17:00','19:00','21:00'] : ['19:00','21:00'];
    
    const today = new Date(); today.setHours(0,0,0,0);
    if (selectedDate.getTime() === today.getTime()) {
        const h = new Date().getHours();
        times = times.filter(t => parseInt(t) > h);
    }
    
    const appointments = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
    const dateStr = formatDateISO(selectedDate);
    
    const available = times.filter(t => !appointments.some(a => a.date === dateStr && a.time === t));
    
    if (available.length === 0) {
        container.style.display = 'none';
        const msg = document.getElementById('noSlotsMessage');
        if (msg) msg.style.display = 'block';
        return;
    }
    
    const msg = document.getElementById('noSlotsMessage');
    if (msg) msg.style.display = 'none';
    
    times.forEach(time => {
        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.textContent = time;
        if (appointments.some(a => a.date === dateStr && a.time === time)) {
            slot.classList.add('disabled');
        } else {
            slot.addEventListener('click', () => selectTime(time, slot));
        }
        if (selectedTime === time) slot.classList.add('selected');
        grid.appendChild(slot);
    });
}

function selectTime(time, slot) {
    document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
    slot.classList.add('selected');
    selectedTime = time;
    updateSummary();
}

// ==========================================
// AGENDAMENTO
// ==========================================

function openModal(serviceName, price) {
    currentService = serviceName; currentPrice = price;
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    renderCalendar();
    const ts = document.getElementById('timeSlotsContainer');
    const os = document.getElementById('orderSummary');
    const cb = document.getElementById('confirmBtn');
    if (ts) ts.style.display = 'none';
    if (os) os.style.display = 'none';
    if (cb) cb.disabled = true;
    selectedDate = null; selectedTime = null;
    const form = document.getElementById('bookingForm');
    if (form) form.reset();
}

function closeModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function updateSummary() {
    if (!currentService || !selectedDate || !selectedTime) return;
    const s = document.getElementById('summaryService');
    const p = document.getElementById('summaryPrice');
    const d = document.getElementById('summaryDate');
    const t = document.getElementById('summaryTime');
    const os = document.getElementById('orderSummary');
    const cb = document.getElementById('confirmBtn');
    
    if (s) s.textContent = currentService;
    if (p) p.textContent = `R$ ${currentPrice},00`;
    if (d) d.textContent = `${String(selectedDate.getDate()).padStart(2,'0')}/${String(selectedDate.getMonth()+1).padStart(2,'0')}/${selectedDate.getFullYear()}`;
    if (t) t.textContent = selectedTime;
    if (os) os.style.display = 'block';
    if (cb) cb.disabled = false;
}

// ==========================================
// PIX
// ==========================================

function copyPixKey() {
    const input = document.getElementById('pixKey');
    const btn = document.getElementById('btnCopyPix');
    const txt = document.getElementById('copyText');
    if (!input || !btn) return;
    
    input.select(); input.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(input.value).then(() => {
        const orig = btn.innerHTML;
        btn.classList.add('copied','success');
        if (txt) txt.textContent = 'Copiado!';
        btn.innerHTML = `<svg viewBox="0 0 24 24" class="copy-icon"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg><span>Copiado!</span>`;
        setTimeout(() => { btn.classList.remove('copied','success'); btn.innerHTML = orig; if (txt) txt.textContent = 'Copiar'; }, 2000);
    }).catch(() => {
        document.execCommand('copy');
        btn.classList.add('copied');
        if (txt) txt.textContent = 'Copiado!';
        setTimeout(() => { btn.classList.remove('copied'); if (txt) txt.textContent = 'Copiar'; }, 2000);
    });
}

// ==========================================
// LISTA DE ESPERA
// ==========================================

function openWaitlistModal() {
    document.getElementById('waitlistService').value = currentService || '';
    document.getElementById('waitlistPrice').value = currentPrice || '';
    document.getElementById('waitlistPreferredDate').value = selectedDate ? formatDateISO(selectedDate) : '';
    document.getElementById('wlService').textContent = currentService || 'Não especificado';
    document.getElementById('wlPrice').textContent = currentPrice ? `R$ ${currentPrice},00` : 'Não especificado';
    document.getElementById('wlDate').textContent = selectedDate ? formatRelativeDate(selectedDate) : 'Qualquer data';
    
    const modal = document.getElementById('waitlistModal');
    if (modal) { modal.classList.add('active'); document.body.style.overflow = 'hidden'; }
    setupPhoneMask('waitlistPhone');
}

function closeWaitlistModal() {
    const modal = document.getElementById('waitlistModal');
    if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
    const form = document.getElementById('waitlistForm');
    if (form) form.reset();
}

function formatPeriod(p) {
    const m = { 'esta-semana':'Esta semana', 'proxima-semana':'Próxima semana', 'quinzena':'Próximos 15 dias', 'mes':'Próximo mês', 'flexivel':'Qualquer data' };
    return m[p] || p;
}

function showWaitlistSuccess() {
    const content = document.querySelector('#waitlistModal .modal-content');
    if (!content) return;
    content.innerHTML = `<button class="modal-close" onclick="closeWaitlistModal()">×</button><div class="waitlist-success"><div class="waitlist-success-icon"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg></div><h3>Você está na lista! ✨</h3><p>Obrigada pelo interesse! Você será avisada pelo WhatsApp assim que abrir um horário para <strong>${currentService || 'o serviço escolhido'}</strong>.</p><div class="waitlist-next-steps"><h4>Próximos passos:</h4><ul><li>Fique de olho no seu WhatsApp</li><li>Responderei em até 24h se abrir vaga</li><li>Horários de cancelamento são prioridade da lista</li></ul></div><button class="btn-confirm" onclick="closeWaitlistModal()" style="margin-top:25px">Entendi, obrigada! 💕</button></div>`;
}

function showWaitlistPanel() {
    const list = JSON.parse(localStorage.getItem('yas_femme_waitlist') || '[]');
    if (list.length === 0) { console.log('📋 Lista vazia'); return; }
    console.log('📋 LISTA DE ESPERA\n' + '='.repeat(50));
    list.sort((a,b) => new Date(b.addedAt) - new Date(a.addedAt)).forEach((e,i) => {
        console.log(`\n#${i+1} ${e.name}\n📱 ${e.phone}\n💅 ${e.service}\n📅 ${e.periodLabel}`);
    });
}

// ==========================================
// CALCULADORA DE MANUTENÇÃO
// ==========================================

const MAINTENANCE_CONFIG = {
    'lash-lifting': { days: null, label: 'Sem manutenção', type: 'none' },
    'fio-a-fio': { days: null, label: 'Sem manutenção', type: 'none' },
    'volume-brasileiro': { days: { min: 15, max: 20 }, label: '15-20 dias', type: 'maintenance' },
    'volume-egipcio': { days: { min: 15, max: 20 }, label: '15-20 dias', type: 'maintenance' },
    'anime': { days: null, label: 'Sem manutenção', type: 'none' }
};

function getServiceName(key) {
    const n = { 'lash-lifting':'Lash Lifting', 'fio-a-fio':'Fio a Fio', 'volume-brasileiro':'Volume Brasileiro', 'volume-egipcio':'Volume Egípcio', 'anime':'Anime' };
    return n[key] || key;
}

function generateWhatsappLink(service, period, status) {
    const msg = `Olá! 👋\n\nGostaria de agendar minha manutenção de cílios.\n\n💅 *Serviço:* ${getServiceName(service)}\n⏰ *Manutenção:* ${period}\n📊 *Status:* ${status}\n\nAguardo disponibilidade!`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function calculateMaintenance(e) {
    if (e) e.preventDefault();
    
    const service = document.getElementById('maintenanceService')?.value;
    const appDate = document.getElementById('maintenanceDate')?.value;
    
    if (!service || !appDate) { alert('Selecione serviço e data.'); return false; }
    
    const config = MAINTENANCE_CONFIG[service];
    const today = new Date(); today.setHours(0,0,0,0);
    const todayStr = formatDateISO(today);
    const daysSince = daysDifference(appDate, todayStr);
    
    document.getElementById('resultApplicationDate').textContent = formatDateBR(appDate);
    document.getElementById('resultMaintenancePeriod').textContent = config.label;
    
    const header = document.getElementById('resultHeader');
    const indicator = document.getElementById('statusIndicator');
    const title = document.getElementById('resultTitle');
    const window = document.getElementById('resultIdealWindow');
    const status = document.getElementById('resultStatus');
    const days = document.getElementById('resultDaysLeft');
    const btn = document.getElementById('btnWhatsappReminder');
    
    if (!header || !indicator) return false;
    
    indicator.className = 'status-indicator';
    status.className = 'result-value status-text';
    
    if (config.type === 'none') {
        header.style.background = 'linear-gradient(135deg,#2196F3,#1976D2)';
        indicator.classList.add('blue'); indicator.textContent = '✨';
        title.textContent = 'Técnica sem manutenção';
        window.textContent = 'Aproveite até cair naturalmente';
        status.textContent = 'Sem prazo definido'; status.classList.add('blue');
        days.textContent = '∞';
        btn.href = generateWhatsappLink(service, config.label, 'sem-manutencao');
    } else {
        const start = new Date(appDate + 'T00:00:00'); start.setDate(start.getDate() + config.days.min);
        const end = new Date(appDate + 'T00:00:00'); end.setDate(end.getDate() + config.days.max);
        window.textContent = `${formatDateBR(start.toISOString().split('T')[0])} até ${formatDateBR(end.toISOString().split('T')[0])}`;
        
        let st, cls, grad, icon, txt;
        if (daysSince < config.days.min) {
            st = 'No prazo'; cls = 'green'; grad = 'linear-gradient(135deg,#4CAF50,#45a049)'; icon = '✅'; txt = `${config.days.min - daysSince} dias para o período ideal`;
        } else if (daysSince <= config.days.max) {
            st = 'Período Ideal!'; cls = 'yellow'; grad = 'linear-gradient(135deg,#FFC107,#FFB300)'; icon = '🎯'; txt = `${config.days.max - daysSince} dias restantes`;
        } else {
            st = 'Atrasado'; cls = 'red'; grad = 'linear-gradient(135deg,#f44336,#d32f2f)'; icon = '⚠️'; txt = `${daysSince - config.days.max} dias atrasado`;
        }
        
        header.style.background = grad;
        indicator.classList.add(cls); indicator.textContent = icon;
        title.textContent = st;
        status.textContent = st; status.classList.add(cls);
        days.textContent = txt;
        btn.href = generateWhatsappLink(service, config.label, st);
    }
    
    const result = document.getElementById('maintenanceResult');
    if (result) { result.style.display = 'block'; setTimeout(() => result.scrollIntoView({behavior:'smooth'}), 100); }
    return false;
}

function saveReminder() {
    const service = document.getElementById('maintenanceService')?.value;
    const date = document.getElementById('maintenanceDate')?.value;
    if (!service || !date) { alert('Preencha os dados primeiro.'); return; }
    
    const r = { id: Date.now(), service: getServiceName(service), applicationDate: date, maintenancePeriod: MAINTENANCE_CONFIG[service].label, savedAt: new Date().toISOString() };
    const list = JSON.parse(localStorage.getItem('yas_femme_reminders') || '[]');
    list.push(r);
    localStorage.setItem('yas_femme_reminders', JSON.stringify(list));
    alert('✅ Lembrete salvo!');
}

function showSavedReminders() {
    const list = JSON.parse(localStorage.getItem('yas_femme_reminders') || '[]');
    if (!list.length) { console.log('📅 Nenhum lembrete'); return; }
    console.log('📅 LEMBRETES\n' + '='.repeat(50));
    list.forEach((r,i) => console.log(`#${i+1} ${r.service}\n📅 ${formatDateBR(r.applicationDate)}\n⏰ ${r.maintenancePeriod}`));
}

// ==========================================
// INICIALIZAÇÃO ÚNICA (TUDO AQUI!)
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('✅ Yas Femme Studio - Iniciando');
    
    // Urgência
    if (typeof updateUrgencyIndicators === 'function') {
        updateUrgencyIndicators();
        setInterval(updateUrgencyIndicators, 5 * 60 * 1000);
    }
    
    // Máscaras
    setupPhoneMask('clientPhone');
    
    // Scroll reveal
    setupScrollReveal();
    
    // Calendário
    if (document.getElementById('calendarGrid')) renderCalendar();
    
    // Modal booking
    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('clientName')?.value;
            const phone = document.getElementById('clientPhone')?.value;
            const address = document.getElementById('clientAddress')?.value;
            
            if (!name || !phone || !address || !selectedDate || !selectedTime) {
                alert('Preencha todos os campos.'); return;
            }
            
            const appt = { name, phone, address, service: currentService, price: currentPrice, date: formatDateISO(selectedDate), time: selectedTime, bookedAt: new Date().toISOString() };
            const list = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
            list.push(appt);
            localStorage.setItem('yas_femme_appointments', JSON.stringify(list));
            
            const msg = `Olá! Confirmação de agendamento:\n\n👤 ${name}\n📱 ${phone}\n📍 ${address}\n\n💅 ${currentService}\n💰 R$ ${currentPrice},00\n📅 ${formatRelativeDate(selectedDate)}\n⏰ ${selectedTime}\n\nAguardo confirmação!`;
            closeModal();
            setTimeout(() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank'), 500);
            alert('✅ Agendamento registrado! Redirecionando para WhatsApp...');
            if (typeof updateUrgencyIndicators === 'function') updateUrgencyIndicators();
        });
    }
    
    // Fechar modal ao clicar fora
    const bookingModal = document.getElementById('bookingModal');
    if (bookingModal) {
        bookingModal.addEventListener('click', (e) => { if (e.target === bookingModal) closeModal(); });
    }
    
    // PIX
    const pixInput = document.getElementById('pixKey');
    if (pixInput) pixInput.addEventListener('click', function() { this.select(); });
    
    // Waitlist modal close
    const waitlistModal = document.getElementById('waitlistModal');
    if (waitlistModal) {
        waitlistModal.addEventListener('click', (e) => { if (e.target === waitlistModal) closeWaitlistModal(); });
    }
    
    // Waitlist form
    const waitlistForm = document.getElementById('waitlistForm');
    if (waitlistForm) {
        waitlistForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const entry = {
                id: Date.now(),
                name: document.getElementById('waitlistName')?.value,
                phone: document.getElementById('waitlistPhone')?.value,
                service: document.getElementById('waitlistService')?.value,
                price: document.getElementById('waitlistPrice')?.value,
                period: document.getElementById('waitlistPeriod')?.value,
                periodLabel: formatPeriod(document.getElementById('waitlistPeriod')?.value),
                notes: document.getElementById('waitlistNotes')?.value,
                addedAt: new Date().toISOString()
            };
            const list = JSON.parse(localStorage.getItem('yas_femme_waitlist') || '[]');
            list.push(entry);
            localStorage.setItem('yas_femme_waitlist', JSON.stringify(list));
            
            const msg = `🔔 *NOVA NA LISTA*\n\n👤 ${entry.name}\n📱 ${entry.phone}\n💅 ${entry.service}\n📅 ${entry.periodLabel}\n${entry.notes ? `📝 ${entry.notes}\n` : ''}`;
            showWaitlistSuccess();
            setTimeout(() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`, '_blank'), 1500);
        });
    }
    
    // Manutenção
    const maintForm = document.getElementById('maintenanceForm');
    const maintDate = document.getElementById('maintenanceDate');
    if (maintForm && maintDate) {
        maintDate.setAttribute('max', new Date().toISOString().split('T')[0]);
        maintForm.addEventListener('submit', calculateMaintenance);
        console.log('✅ Calculadora inicializada');
    }
    
    console.log('🎉 Yas Femme Studio - Pronto!');
});
