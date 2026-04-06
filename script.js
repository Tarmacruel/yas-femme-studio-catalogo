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

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    updateUrgencyIndicators();
    setInterval(updateUrgencyIndicators, 5 * 60 * 1000);
    
    // Máscara para telefone
    setupPhoneMask();
    
    // Scroll reveal
    setupScrollReveal();
});

// Máscara de Telefone
function setupPhoneMask() {
    const phoneInput = document.getElementById('clientPhone');
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

// Scroll Reveal Animation
function setupScrollReveal() {
    const reveals = document.querySelectorAll('.service-card');
    
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
        const dateStr = formatRelativeDate(nextAvailable.date);
        const timeStr = nextAvailable.time;
        nextSlotElement.textContent = `${dateStr} às ${timeStr}`;
    } else {
        nextSlotElement.textContent = "Sem horários disponíveis";
        nextSlotElement.style.color = "#ff6b6b";
    }
    
    weeklySlotsElement.textContent = `${weeklySlots.available} de ${weeklySlots.total} horários`;
    
    weeklyBadge.classList.remove('high-availability', 'medium-availability', 'low-availability');
    
    const percentage = weeklySlots.total > 0 ? (weeklySlots.available / weeklySlots.total) * 100 : 0;
    
    if (percentage > 60) {
        weeklyBadge.classList.add('high-availability');
    } else if (percentage > 30) {
        weeklyBadge.classList.add('medium-availability');
    } else {
        weeklyBadge.classList.add('low-availability');
    }
    
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
    const maxSearchDays = 60;
    
    for (let day = 0; day < maxSearchDays; day++) {
        const checkDate = new Date(startDate);
        checkDate.setDate(startDate.getDate() + day);
        
        if (checkDate.getDay() === 0) continue;
        
        const dayOfWeek = checkDate.getDay();
        const isSaturday = dayOfWeek === 6;
        
        let times = isSaturday ? 
            ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'] : 
            ['19:00', '21:00'];
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (checkDate.getTime() === today.getTime()) {
            const currentHour = new Date().getHours();
            times = times.filter(time => parseInt(time) > currentHour);
        }
        
        const dateStr = formatDateISO(checkDate);
        for (const time of times) {
            const isOccupied = appointments.some(app => 
                app.date === dateStr && app.time === time
            );
            
            if (!isOccupied) {
                return { date: checkDate, time: time };
            }
        }
    }
    
    return null;
}

function countWeeklyAvailableSlots(appointments, startDate) {
    const nextMonday = new Date(startDate);
    const dayOfWeek = startDate.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    nextMonday.setDate(startDate.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    
    const saturday = new Date(nextMonday);
    saturday.setDate(nextMonday.getDate() + 5);
    
    let totalSlots = 0;
    let availableSlots = 0;
    
    for (let d = new Date(nextMonday); d <= saturday; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (dayOfWeek === 0) continue;
        
        const isSaturday = dayOfWeek === 6;
        let times = isSaturday ? 
            ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'] : 
            ['19:00', '21:00'];
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (d.getTime() === today.getTime()) {
            const currentHour = new Date().getHours();
            times = times.filter(time => parseInt(time) > currentHour);
        }
        
        totalSlots += times.length;
        
        const dateStr = formatDateISO(d);
        availableSlots += times.filter(time => {
            return !appointments.some(app => 
                app.date === dateStr && app.time === time
            );
        }).length;
    }
    
    return { total: totalSlots, available: availableSlots };
}

function formatRelativeDate(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const dateToCheck = new Date(date);
    dateToCheck.setHours(0, 0, 0, 0);
    
    if (dateToCheck.getTime() === today.getTime()) {
        return "Hoje";
    } else if (dateToCheck.getTime() === tomorrow.getTime()) {
        return "Amanhã";
    } else {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month}`;
    }
}

function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ==========================================
// SISTEMA DE CALENDÁRIO
// ==========================================

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;
    
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';
    
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    dayNames.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-day-header';
        header.textContent = day;
        grid.appendChild(header);
    });
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 60);
    
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        grid.appendChild(empty);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.textContent = day;
        
        const dayOfWeek = date.getDay();
        
        if (dayOfWeek === 0) {
            cell.classList.add('sunday', 'disabled');
        } else if (date < today || date > maxDate) {
            cell.classList.add('disabled');
        } else {
            cell.addEventListener('click', () => selectDate(date, cell));
        }
        
        if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
            cell.classList.add('selected');
        }
        
        grid.appendChild(cell);
    }
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

function selectDate(date, cell) {
    document.querySelectorAll('.calendar-day').forEach(c => c.classList.remove('selected'));
    cell.classList.add('selected');
    
    selectedDate = date;
    selectedTime = null;
    
    renderTimeSlots();
    updateSummary();
}

function renderTimeSlots() {
    if (!selectedDate) return;
    
    const container = document.getElementById('timeSlotsContainer');
    const grid = document.getElementById('timeGrid');
    
    container.style.display = 'block';
    grid.innerHTML = '';
    
    const dayOfWeek = selectedDate.getDay();
    const isSaturday = dayOfWeek === 6;
    
    let times = isSaturday ? 
        ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'] : 
        ['19:00', '21:00'];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate.getTime() === today.getTime()) {
        const currentHour = new Date().getHours();
        times = times.filter(time => parseInt(time) > currentHour);
    }
    
    const appointments = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
    const dateStr = formatDateISO(selectedDate);
    
    times.forEach(time => {
        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.textContent = time;
        
        const isOccupied = appointments.some(app => 
            app.date === dateStr && app.time === time
        );
        
        if (isOccupied) {
            slot.classList.add('disabled');
        } else {
            slot.addEventListener('click', () => selectTime(time, slot));
        }
        
        if (selectedTime === time) {
            slot.classList.add('selected');
        }
        
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
// SISTEMA DE AGENDAMENTO
// ==========================================

function openModal(serviceName, price, maintenanceType) {
    currentService = serviceName;
    currentPrice = price;
    
    document.getElementById('bookingModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    renderCalendar();
    document.getElementById('timeSlotsContainer').style.display = 'none';
    document.getElementById('orderSummary').style.display = 'none';
    document.getElementById('confirmBtn').disabled = true;
    
    selectedDate = null;
    selectedTime = null;
    
    document.getElementById('bookingForm').reset();
}

function closeModal() {
    document.getElementById('bookingModal').classList.remove('active');
    document.body.style.overflow = '';
}

function updateSummary() {
    if (!currentService || !selectedDate || !selectedTime) return;
    
    document.getElementById('summaryService').textContent = currentService;
    document.getElementById('summaryPrice').textContent = `R$ ${currentPrice},00`;
    
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDate.getFullYear();
    document.getElementById('summaryDate').textContent = `${day}/${month}/${year}`;
    document.getElementById('summaryTime').textContent = selectedTime;
    
    document.getElementById('orderSummary').style.display = 'block';
    document.getElementById('confirmBtn').disabled = false;
}

// Formulário
document.getElementById('bookingForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const name = document.getElementById('clientName').value;
    const phone = document.getElementById('clientPhone').value;
    const address = document.getElementById('clientAddress').value;
    
    if (!name || !phone || !address || !selectedDate || !selectedTime) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }
    
    const appointment = {
        name: name,
        phone: phone,
        address: address,
        service: currentService,
        price: currentPrice,
        date: formatDateISO(selectedDate),
        time: selectedTime,
        bookedAt: new Date().toISOString()
    };
    
    const appointments = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
    appointments.push(appointment);
    localStorage.setItem('yas_femme_appointments', JSON.stringify(appointments));
    
    const message = `Olá! Gostaria de confirmar meu agendamento no Yas Femme Studio:\n\n` +
                   `👤 Nome: ${name}\n` +
                   `📱 Telefone: ${phone}\n` +
                   `📍 Endereço: ${address}\n\n` +
                   `💅 Serviço: ${currentService}\n` +
                   `💰 Valor: R$ ${currentPrice},00\n` +
                   `📅 Data: ${formatRelativeDate(selectedDate)} (${String(selectedDate.getDate()).padStart(2, '0')}/${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${selectedDate.getFullYear()})\n` +
                   `⏰ Horário: ${selectedTime}\n\n` +
                   `Aguardo confirmação!`;
    
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    
    closeModal();
    
    setTimeout(() => {
        window.open(whatsappUrl, '_blank');
    }, 500);
    
    alert('Agendamento registrado! Você será redirecionado para o WhatsApp para confirmar.');
    
    updateUrgencyIndicators();
});

// Fechar modal ao clicar fora
document.getElementById('bookingModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});
// ==========================================
// FUNÇÃO COPIAR CHAVE PIX
// ==========================================

function copyPixKey() {
    const pixKeyInput = document.getElementById('pixKey');
    const btnCopy = document.getElementById('btnCopyPix');
    const copyText = document.getElementById('copyText');
    
    // Selecionar e copiar texto
    pixKeyInput.select();
    pixKeyInput.setSelectionRange(0, 99999); // Para mobile
    
    // Copiar para clipboard
    navigator.clipboard.writeText(pixKeyInput.value).then(() => {
        // Feedback visual
        const originalHTML = btnCopy.innerHTML;
        
        btnCopy.classList.add('copied', 'success');
        copyText.textContent = 'Copiado!';
        
        // Ícone de check
        btnCopy.innerHTML = `
            <svg viewBox="0 0 24 24" class="copy-icon">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span>Copiado!</span>
        `;
        
        // Reverter após 2 segundos
        setTimeout(() => {
            btnCopy.classList.remove('copied', 'success');
            btnCopy.innerHTML = originalHTML;
        }, 2000);
        
    }).catch(err => {
        // Fallback para navegadores antigos
        document.execCommand('copy');
        
        btnCopy.classList.add('copied');
        copyText.textContent = 'Copiado!';
        
        setTimeout(() => {
            btnCopy.classList.remove('copied');
            copyText.textContent = 'Copiar';
        }, 2000);
    });
}

// Permitir copiar ao clicar no input também
document.addEventListener('DOMContentLoaded', function() {
    const pixKeyInput = document.getElementById('pixKey');
    if (pixKeyInput) {
        pixKeyInput.addEventListener('click', function() {
            this.select();
        });
    }
});
// ==========================================
// AJUSTE DE SCROLL NO MODAL MOBILE
// ==========================================

// Prevenir scroll do body quando modal estiver aberto
function preventBodyScroll() {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
}

function enableBodyScroll() {
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
}

// Sobrescrever funções existentes
const originalOpenModal = openModal;
openModal = function(serviceName, price, maintenanceType) {
    originalOpenModal(serviceName, price, maintenanceType);
    preventBodyScroll();
}

const originalCloseModal = closeModal;
closeModal = function() {
    originalCloseModal();
    enableBodyScroll();
}

// Fechar modal ao clicar fora
document.getElementById('bookingModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});
// ==========================================
// SISTEMA DE LISTA DE ESPERA
// ==========================================

// Abrir Modal da Lista de Espera
function openWaitlistModal() {
    // Preencher dados do serviço
    document.getElementById('waitlistService').value = currentService || '';
    document.getElementById('waitlistPrice').value = currentPrice || '';
    document.getElementById('waitlistPreferredDate').value = selectedDate ? formatDateISO(selectedDate) : '';
    
    document.getElementById('wlService').textContent = currentService || 'Não especificado';
    document.getElementById('wlPrice').textContent = currentPrice ? `R$ ${currentPrice},00` : 'Não especificado';
    document.getElementById('wlDate').textContent = selectedDate ? formatRelativeDate(selectedDate) : 'Qualquer data';
    
    // Mostrar modal
    document.getElementById('waitlistModal').classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Máscara para telefone
    setupWaitlistPhoneMask();
}

// Fechar Modal da Lista de Espera
function closeWaitlistModal() {
    document.getElementById('waitlistModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('waitlistForm').reset();
}

// Máscara para telefone do waitlist
function setupWaitlistPhoneMask() {
    const phoneInput = document.getElementById('waitlistPhone');
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

// Formatar período para exibição
function formatPeriod(period) {
    const periods = {
        'esta-semana': 'Esta semana',
        'proxima-semana': 'Próxima semana',
        'quinzena': 'Próximos 15 dias',
        'mes': 'Próximo mês',
        'flexivel': 'Qualquer data'
    };
    return periods[period] || period;
}

// Salvar na Lista de Espera
document.getElementById('waitlistForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const entry = {
        id: Date.now(),
        name: document.getElementById('waitlistName').value,
        phone: document.getElementById('waitlistPhone').value,
        service: document.getElementById('waitlistService').value,
        price: document.getElementById('waitlistPrice').value,
        period: document.getElementById('waitlistPeriod').value,
        periodLabel: formatPeriod(document.getElementById('waitlistPeriod').value),
        notes: document.getElementById('waitlistNotes').value,
        preferredDate: document.getElementById('waitlistPreferredDate').value,
        addedAt: new Date().toISOString()
    };
    
    // Salvar no localStorage
    const waitlist = JSON.parse(localStorage.getItem('yas_femme_waitlist') || '[]');
    waitlist.push(entry);
    localStorage.setItem('yas_femme_waitlist', JSON.stringify(waitlist));
    
    // Gerar mensagem para WhatsApp
    const message = `🔔 *NOVA PESSOA NA LISTA DE ESPERA*\n\n` +
                   `👤 *Nome:* ${entry.name}\n` +
                   `📱 *WhatsApp:* ${entry.phone}\n` +
                   `💅 *Serviço:* ${entry.service}\n` +
                   `💰 *Valor:* ${entry.price ? `R$ ${entry.price},00` : 'N/A'}\n` +
                   `📅 *Período:* ${entry.periodLabel}\n` +
                   `${entry.notes ? `📝 *Obs:* ${entry.notes}\n` : ''}` +
                   `\n⏰ *Entrou em:* ${new Date().toLocaleString('pt-BR')}`;
    
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    
    // Mostrar confirmação
    showWaitlistSuccess();
    
    // Abrir WhatsApp após 1.5s
    setTimeout(() => {
        window.open(whatsappUrl, '_blank');
    }, 1500);
});

// Mostrar Tela de Sucesso
function showWaitlistSuccess() {
    const modalContent = document.querySelector('#waitlistModal .modal-content');
    
    modalContent.innerHTML = `
        <button class="modal-close" onclick="closeWaitlistModal()">×</button>
        <div class="waitlist-success">
            <div class="waitlist-success-icon">
                <svg viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
            </div>
            <h3>Você está na lista! ✨</h3>
            <p>Obrigada pelo interesse! Você será avisada pelo WhatsApp assim que abrir um horário para <strong>${currentService || 'o serviço escolhido'}</strong>.</p>
            
            <div class="waitlist-next-steps">
                <h4>Próximos passos:</h4>
                <ul>
                    <li>Fique de olho no seu WhatsApp</li>
                    <li>Responderei em até 24h se abrir vaga</li>
                    <li>Horários de cancelamento são prioridade da lista</li>
                </ul>
            </div>
            
            <button class="btn-confirm" onclick="closeWaitlistModal()" style="margin-top: 25px;">
                Entendi, obrigada! 💕
            </button>
        </div>
    `;
}

// Verificar se há horários e mostrar mensagem adequada
function checkAndShowSlots(times, appointments, dateStr) {
    const availableTimes = times.filter(time => {
        return !appointments.some(app => app.date === dateStr && app.time === time);
    });
    
    const noSlotsMessage = document.getElementById('noSlotsMessage');
    const timeSlotsContainer = document.getElementById('timeSlotsContainer');
    
    if (availableTimes.length === 0) {
        // Não há horários - mostrar mensagem de lista de espera
        timeSlotsContainer.style.display = 'none';
        noSlotsMessage.style.display = 'block';
        return false;
    } else {
        // Há horários - mostrar normalmente
        timeSlotsContainer.style.display = 'block';
        noSlotsMessage.style.display = 'none';
        return true;
    }
}

// Atualizar renderTimeSlots para usar a nova função
const originalRenderTimeSlots = renderTimeSlots;
renderTimeSlots = function() {
    if (!selectedDate) return;
    
    const container = document.getElementById('timeSlotsContainer');
    const grid = document.getElementById('timeGrid');
    
    container.style.display = 'block';
    grid.innerHTML = '';
    
    const dayOfWeek = selectedDate.getDay();
    const isSaturday = dayOfWeek === 6;
    
    let times = isSaturday ? 
        ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'] : 
        ['19:00', '21:00'];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate.getTime() === today.getTime()) {
        const currentHour = new Date().getHours();
        times = times.filter(time => parseInt(time) > currentHour);
    }
    
    const appointments = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
    const dateStr = formatDateISO(selectedDate);
    
    // Usar nova função para verificar disponibilidade
    const hasSlots = checkAndShowSlots(times, appointments, dateStr);
    
    if (!hasSlots) return; // Já mostrou a mensagem de lista de espera
    
    // Renderizar slots normais
    times.forEach(time => {
        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.textContent = time;
        
        const isOccupied = appointments.some(app => 
            app.date === dateStr && app.time === time
        );
        
        if (isOccupied) {
            slot.classList.add('disabled');
        } else {
            slot.addEventListener('click', () => selectTime(time, slot));
        }
        
        if (selectedTime === time) {
            slot.classList.add('selected');
        }
        
        grid.appendChild(slot);
    });
}

// Fechar modal ao clicar fora (waitlist)
document.addEventListener('DOMContentLoaded', function() {
    const waitlistModal = document.getElementById('waitlistModal');
    if (waitlistModal) {
        waitlistModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeWaitlistModal();
            }
        });
    }
});

// ==========================================
// PAINEL ADMIN - LISTA DE ESPERA (OPCIONAL)
// Para visualizar a lista, acesse o console e digite:
// showWaitlistPanel()
// ==========================================

function showWaitlistPanel() {
    const waitlist = JSON.parse(localStorage.getItem('yas_femme_waitlist') || '[]');
    
    if (waitlist.length === 0) {
        console.log('📋 Lista de espera vazia');
        return;
    }
    
    console.log('📋 LISTA DE ESPERA - Yas Femme Studio');
    console.log('='.repeat(50));
    
    waitlist.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt)).forEach((entry, index) => {
        console.log(`\n#${index + 1} - ${entry.name}`);
        console.log(`   📱 ${entry.phone}`);
        console.log(`   💅 ${entry.service} (R$ ${entry.price},00)`);
        console.log(`   📅 ${entry.periodLabel}`);
        console.log(`   ⏰ ${new Date(entry.addedAt).toLocaleString('pt-BR')}`);
        if (entry.notes) console.log(`   📝 ${entry.notes}`);
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`Total: ${waitlist.length} pessoa(s) na lista`);
}
// ==========================================
// CALCULADORA DE MANUTENÇÃO - CORIGIDO
// ==========================================

// Configurações de Manutenção por Serviço
const MAINTENANCE_CONFIG = {
    'lash-lifting': { days: null, label: 'Sem manutenção', type: 'none' },
    'fio-a-fio': { days: null, label: 'Sem manutenção', type: 'none' },
    'volume-brasileiro': { days: { min: 15, max: 20 }, label: '15-20 dias', type: 'maintenance' },
    'volume-egipcio': { days: { min: 15, max: 20 }, label: '15-20 dias', type: 'maintenance' },
    'anime': { days: null, label: 'Sem manutenção', type: 'none' }
};

// Formatar data para exibição (DD/MM/YYYY)
function formatDateBR(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

// Calcular diferença em dias
function daysDifference(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    const d1 = new Date(date1 + 'T00:00:00');
    const d2 = new Date(date2 + 'T00:00:00');
    return Math.round((d2 - d1) / oneDay);
}

// Obter Nome do Serviço
function getServiceName(serviceKey) {
    const names = {
        'lash-lifting': 'Lash Lifting',
        'fio-a-fio': 'Fio a Fio',
        'volume-brasileiro': 'Volume Brasileiro',
        'volume-egipcio': 'Volume Egípcio',
        'anime': 'Anime'
    };
    return names[serviceKey] || serviceKey;
}

// Gerar Link do WhatsApp
function generateWhatsappLink(service, maintenancePeriod, status) {
    const message = `Olá! 👋\n\nGostaria de agendar minha manutenção de cílios.\n\n` +
                   `💅 *Serviço:* ${getServiceName(service)}\n` +
                   `⏰ *Manutenção:* ${maintenancePeriod}\n` +
                   `📊 *Status:* ${status}\n\n` +
                   `Aguardo disponibilidade de horários!`;
    
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Calcular Manutenção - FUNÇÃO PRINCIPAL
function calculateMaintenance(e) {
    e.preventDefault(); // IMPEDIR RECARGA DA PÁGINA
    
    const service = document.getElementById('maintenanceService').value;
    const applicationDate = document.getElementById('maintenanceDate').value;
    
    if (!service || !applicationDate) {
        alert('Por favor, selecione o serviço e a data da aplicação.');
        return false;
    }
    
    const config = MAINTENANCE_CONFIG[service];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const appDate = new Date(applicationDate + 'T00:00:00');
    const daysSinceApplication = daysDifference(applicationDate, today);
    
    // Atualizar dados no resultado
    document.getElementById('resultApplicationDate').textContent = formatDateBR(applicationDate);
    document.getElementById('resultMaintenancePeriod').textContent = config.label;
    
    const resultHeader = document.getElementById('resultHeader');
    const statusIndicator = document.getElementById('statusIndicator');
    const resultTitle = document.getElementById('resultTitle');
    const resultIdealWindow = document.getElementById('resultIdealWindow');
    const resultStatus = document.getElementById('resultStatus');
    const resultDaysLeft = document.getElementById('resultDaysLeft');
    const btnWhatsapp = document.getElementById('btnWhatsappReminder');
    
    // Remover classes anteriores
    statusIndicator.className = 'status-indicator';
    resultStatus.className = 'result-value status-text';
    
    if (config.type === 'none') {
        // Técnica sem manutenção
        resultHeader.style.background = 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)';
        statusIndicator.classList.add('blue');
        statusIndicator.textContent = '✨';
        resultTitle.textContent = 'Técnica sem manutenção';
        resultIdealWindow.textContent = 'Aproveite até cair naturalmente';
        resultStatus.textContent = 'Sem prazo definido';
        resultStatus.classList.add('blue');
        resultDaysLeft.textContent = '∞';
        
        btnWhatsapp.href = generateWhatsappLink(service, config.label, 'sem-manutencao');
    } else {
        // Técnica com manutenção
        const idealStart = new Date(appDate);
        idealStart.setDate(idealStart.getDate() + config.days.min);
        
        const idealEnd = new Date(appDate);
        idealEnd.setDate(idealEnd.getDate() + config.days.max);
        
        resultIdealWindow.textContent = `${formatDateBR(idealStart.toISOString().split('T')[0])} até ${formatDateBR(idealEnd.toISOString().split('T')[0])}`;
        
        // Determinar status
        let status, statusClass, headerGradient, icon, daysText;
        
        if (daysSinceApplication < config.days.min) {
            const daysUntilIdeal = config.days.min - daysSinceApplication;
            status = 'No prazo';
            statusClass = 'green';
            headerGradient = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
            icon = '✅';
            daysText = `${daysUntilIdeal} dias para o período ideal`;
        } else if (daysSinceApplication <= config.days.max) {
            const daysUntilEnd = config.days.max - daysSinceApplication;
            status = 'Período Ideal!';
            statusClass = 'yellow';
            headerGradient = 'linear-gradient(135deg, #FFC107 0%, #FFB300 100%)';
            icon = '🎯';
            daysText = `${daysUntilEnd} dias restantes do período ideal`;
        } else {
            const daysOverdue = daysSinceApplication - config.days.max;
            status = 'Atrasado';
            statusClass = 'red';
            headerGradient = 'linear-gradient(135deg, #f44336 0%, #d32f2f 100%)';
            icon = '⚠️';
            daysText = `${daysOverdue} dias atrasado`;
        }
        
        resultHeader.style.background = headerGradient;
        statusIndicator.classList.add(statusClass);
        statusIndicator.textContent = icon;
        resultTitle.textContent = status;
        resultStatus.textContent = status;
        resultStatus.classList.add(statusClass);
        resultDaysLeft.textContent = daysText;
        
        btnWhatsapp.href = generateWhatsappLink(service, config.label, status);
    }
    
    // Mostrar resultado com animação
    const resultDiv = document.getElementById('maintenanceResult');
    resultDiv.style.display = 'block';
    
    // Scroll suave até o resultado
    setTimeout(() => {
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    return false;
}

// Salvar Lembrete
function saveReminder() {
    const service = document.getElementById('maintenanceService').value;
    const applicationDate = document.getElementById('maintenanceDate').value;
    
    if (!service || !applicationDate) {
        alert('Por favor, preencha os dados primeiro.');
        return;
    }
    
    const config = MAINTENANCE_CONFIG[service];
    const reminder = {
        id: Date.now(),
        service: getServiceName(service),
        applicationDate: applicationDate,
        maintenancePeriod: config.label,
        savedAt: new Date().toISOString()
    };
    
    // Salvar no localStorage
    const reminders = JSON.parse(localStorage.getItem('yas_femme_reminders') || '[]');
    reminders.push(reminder);
    localStorage.setItem('yas_femme_reminders', JSON.stringify(reminders));
    
    alert('✅ Lembrete salvo com sucesso!\n\nVocê pode consultar seus lembretes salvos no seu navegador.');
}

// Função para ver lembretes salvos (console)
function showSavedReminders() {
    const reminders = JSON.parse(localStorage.getItem('yas_femme_reminders') || '[]');
    
    if (reminders.length === 0) {
        console.log('📅 Nenhum lembrete salvo');
        return;
    }
    
    console.log('📅 LEMBRETES SALVOS - Yas Femme Studio');
    console.log('='.repeat(50));
    
    reminders.forEach((reminder, index) => {
        console.log(`\n#${index + 1} - ${reminder.service}`);
        console.log(`   📅 Aplicação: ${formatDateBR(reminder.applicationDate)}`);
        console.log(`   ⏰ Manutenção: ${reminder.maintenancePeriod}`);
        console.log(`   💾 Salvo em: ${new Date(reminder.savedAt).toLocaleString('pt-BR')}`);
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`Total: ${reminders.length} lembrete(s)`);
}

// INICIALIZAÇÃO - GARANTIR QUE O DOM ESTÁ CARREGADO
document.addEventListener('DOMContentLoaded', function() {
    // Configurar data máxima no input de data (não permitir datas futuras)
    const dateInput = document.getElementById('maintenanceDate');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('max', today);
    }
    
    // ADICIONAR EVENT LISTENER NO FORMULÁRIO
    const maintenanceForm = document.getElementById('maintenanceForm');
    if (maintenanceForm) {
        maintenanceForm.addEventListener('submit', calculateMaintenance);
    }
    
    console.log('✅ Calculadora de Manutenção inicializada');
});
