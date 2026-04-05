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
