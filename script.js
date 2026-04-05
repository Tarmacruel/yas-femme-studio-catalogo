// Configurações e Dados
const WHATSAPP_NUMBER = "557381676132";
const DURATION_HOURS = 2;

// Inicializar indicadores de urgência ao carregar a página
document.addEventListener('DOMContentLoaded', function() {
    updateUrgencyIndicators();
    // Atualizar a cada 5 minutos
    setInterval(updateUrgencyIndicators, 5 * 60 * 1000);
});

// Atualizar Indicadores de Urgência
function updateUrgencyIndicators() {
    const nextSlotElement = document.getElementById('nextSlotText');
    const weeklySlotsElement = document.getElementById('weeklySlotsText');
    const weeklyBadge = document.getElementById('weeklyAvailability');
    const alertElement = document.getElementById('urgencyAlert');
    
    if (!nextSlotElement || !weeklySlotsElement) return;
    
    const appointments = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Encontrar próximo horário disponível
    const nextAvailable = findNextAvailableSlot(appointments, today);
    
    // Calcular horários disponíveis esta semana
    const weeklySlots = countWeeklyAvailableSlots(appointments, today);
    
    // Atualizar próximo horário
    if (nextAvailable) {
        const dateStr = formatRelativeDate(nextAvailable.date);
        const timeStr = nextAvailable.time;
        nextSlotElement.textContent = `${dateStr} às ${timeStr}`;
    } else {
        nextSlotElement.textContent = "Sem horários disponíveis";
        nextSlotElement.style.color = "#f44336";
    }
    
    // Atualizar contador semanal com cores dinâmicas
    weeklySlotsElement.textContent = `${weeklySlots.available} de ${weeklySlots.total} horários`;
    
    // Remover classes anteriores
    weeklyBadge.classList.remove('high-availability', 'medium-availability', 'low-availability');
    
    // Adicionar classe baseada na disponibilidade
    const percentage = (weeklySlots.available / weeklySlots.total) * 100;
    
    if (percentage > 60) {
        weeklyBadge.classList.add('high-availability');
    } else if (percentage > 30) {
        weeklyBadge.classList.add('medium-availability');
    } else {
        weeklyBadge.classList.add('low-availability');
    }
    
    // Atualizar alerta de urgência
    if (weeklySlots.available <= 3) {
        alertElement.innerHTML = `
            <span class="alert-icon">🔥</span>
            <span class="alert-text">Últimos ${weeklySlots.available} horários esta semana!</span>
        `;
        alertElement.style.display = 'flex';
    } else if (weeklySlots.available <= 5) {
        alertElement.innerHTML = `
            <span class="alert-icon">⚡</span>
            <span class="alert-text">Corra! Apenas ${weeklySlots.available} horários disponíveis!</span>
        `;
        alertElement.style.display = 'flex';
    } else {
        alertElement.style.display = 'none';
    }
}

// Encontrar Próximo Horário Disponível
function findNextAvailableSlot(appointments, startDate) {
    const maxSearchDays = 60; // Buscar até 60 dias à frente
    
    for (let day = 0; day < maxSearchDays; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + day);
        
        // Pular domingos
        if (currentDate.getDay() === 0) continue;
        
        const dayOfWeek = currentDate.getDay();
        const isSaturday = dayOfWeek === 6;
        
        // Definir horários baseados no dia
        let times = [];
        if (isSaturday) {
            times = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
        } else {
            times = ['19:00', '21:00'];
        }
        
        // Se for hoje, filtrar horários passados
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (currentDate.getTime() === today.getTime()) {
            const currentHour = new Date().getHours();
            times = times.filter(time => {
                const hour = parseInt(time.split(':')[0]);
                return hour > currentHour;
            });
        }
        
        // Verificar cada horário
        const dateStr = formatDateISO(currentDate);
        for (const time of times) {
            const isOccupied = appointments.some(app => 
                app.date === dateStr && app.time === time
            );
            
            if (!isOccupied) {
                return {
                    date: currentDate,
                    time: time
                };
            }
        }
    }
    
    return null; // Nenhum horário encontrado
}

// Contar Horários Disponíveis Esta Semana
function countWeeklyAvailableSlots(appointments, startDate) {
    // Encontrar próxima segunda-feira
    const nextMonday = new Date(startDate);
    const dayOfWeek = startDate.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    nextMonday.setDate(startDate.getDate() + daysUntilMonday);
    nextMonday.setHours(0, 0, 0, 0);
    
    // Calcular até sábado (6 dias depois)
    const saturday = new Date(nextMonday);
    saturday.setDate(nextMonday.getDate() + 5);
    
    let totalSlots = 0;
    let availableSlots = 0;
    
    // Percorrer de segunda a sábado
    for (let d = new Date(nextMonday); d <= saturday; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        
        // Pular domingos
        if (dayOfWeek === 0) continue;
        
        const isSaturday = dayOfWeek === 6;
        let times = [];
        
        if (isSaturday) {
            times = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
        } else {
            times = ['19:00', '21:00'];
        }
        
        // Se for hoje, filtrar horários passados
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (d.getTime() === today.getTime()) {
            const currentHour = new Date().getHours();
            times = times.filter(time => {
                const hour = parseInt(time.split(':')[0]);
                return hour > currentHour;
            });
        }
        
        totalSlots += times.length;
        
        // Contar disponíveis
        const dateStr = formatDateISO(d);
        availableSlots += times.filter(time => {
            return !appointments.some(app => 
                app.date === dateStr && app.time === time
            );
        }).length;
    }
    
    return { total: totalSlots, available: availableSlots };
}

// Formatar Data Relativa (hoje, amanhã, etc)
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

// Elementos do DOM
const modal = document.getElementById('bookingModal');
const bookingForm = document.getElementById('bookingForm');
const bookingTimeSelect = document.getElementById('bookingTime');
const summaryDiv = document.getElementById('bookingSummary');
const calendarDays = document.getElementById('calendarDays');
const currentMonthYear = document.getElementById('currentMonthYear');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');

// Estado do Calendário
let currentDate = new Date();
let selectedDate = null;

// Abrir Modal de Agendamento
function openBookingModal(serviceName, price) {
    document.getElementById('selectedService').value = serviceName;
    document.getElementById('selectedPrice').value = price;
    
    // Atualizar resumo inicial
    document.getElementById('summaryService').textContent = serviceName;
    document.getElementById('summaryPrice').textContent = price;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Resetar estado do calendário ao abrir
    currentDate = new Date();
    selectedDate = null;
    renderCalendar();
    updateAvailableTimes();
}

// Fechar Modal
function closeBookingModal() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    bookingForm.reset();
    summaryDiv.style.display = 'none';
    bookingTimeSelect.disabled = true;
    selectedDate = null;
}

// Fechar modal ao clicar fora dele
window.onclick = function(event) {
    if (event.target == modal) {
        closeBookingModal();
    }
}

// Lógica do Calendário
function renderCalendar() {
    calendarDays.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
    
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    currentMonthYear.textContent = `${monthNames[month]} ${year}`;
    
    // Dias vazios no início
    for (let i = 0; i < firstDayOfMonth; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('calendar-day', 'empty');
        calendarDays.appendChild(emptyDiv);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 60);
    
    for (let day = 1; day <= lastDateOfMonth; day++) {
        const date = new Date(year, month, day);
        const dayDiv = document.createElement('div');
        dayDiv.classList.add('calendar-day');
        dayDiv.textContent = day;
        
        const dateString = formatDateISO(date);
        
        // Verificar se é final de semana
        if (date.getDay() === 0 || date.getDay() === 6) {
            dayDiv.classList.add('weekend');
        }
        
        // Bloquear dias passados, domingos ou muito distantes
        if (date < today || date > maxDate || date.getDay() === 0) {
            dayDiv.classList.add('disabled');
            if (date.getDay() === 0) {
                dayDiv.classList.add('sunday');
                dayDiv.title = "Não trabalhamos aos domingos";
            }
        } else {
            dayDiv.addEventListener('click', () => selectDate(date));
            
            if (selectedDate && dateString === formatDateISO(selectedDate)) {
                dayDiv.classList.add('selected');
            }
            
            if (date.getTime() === today.getTime()) {
                dayDiv.classList.add('today');
            }
        }
        
        calendarDays.appendChild(dayDiv);
    }
}

function selectDate(date) {
    selectedDate = date;
    renderCalendar();
    updateAvailableTimes();
    updateSummary();
}

function formatDateISO(date) {
    return date.toISOString().split('T')[0];
}

function formatDateBR(date) {
    const daysOfWeek = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dayOfWeek = daysOfWeek[date.getDay()];
    return `${day}/${month}/${year} - ${dayOfWeek}`;
}

prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

// Lógica de Horários Disponíveis
function updateAvailableTimes() {
    bookingTimeSelect.innerHTML = '<option value="">Selecione um horário...</option>';
    
    if (!selectedDate) {
        bookingTimeSelect.disabled = true;
        return;
    }

    bookingTimeSelect.disabled = false;
    
    let times = [];
    const dayOfWeek = selectedDate.getDay();
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    
    if (isWeekend) {
        times = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
    } else {
        times = ['19:00', '21:00'];
    }

    // Filtrar horários passados se a data selecionada for hoje
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDateObj = new Date(selectedDate);
    selectedDateObj.setHours(0, 0, 0, 0);

    if (selectedDateObj.getTime() === today.getTime()) {
        const now = new Date();
        const currentHour = now.getHours();
        times = times.filter(time => {
            const hour = parseInt(time.split(':')[0]);
            return hour > currentHour;
        });
    }

    const appointments = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
    const dateStr = formatDateISO(selectedDate);
    
    let availableCount = 0;
    times.forEach(time => {
        const isOccupied = appointments.some(app => app.date === dateStr && app.time === time);
        
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time;
        
        if (isOccupied) {
            option.disabled = true;
            option.textContent += ' (Ocupado)';
        } else {
            availableCount++;
        }
        
        bookingTimeSelect.appendChild(option);
    });

    if (availableCount === 0) {
        const option = document.createElement('option');
        option.textContent = "Não há horários disponíveis para este dia";
        option.disabled = true;
        bookingTimeSelect.innerHTML = '';
        bookingTimeSelect.appendChild(option);
    }
}

// Atualizar Resumo do Agendamento
function updateSummary() {
    const time = bookingTimeSelect.value;
    
    if (selectedDate && time) {
        document.getElementById('summaryDate').textContent = formatDateBR(selectedDate);
        document.getElementById('summaryTime').textContent = time;
        summaryDiv.style.display = 'block';
    } else if (selectedDate) {
        document.getElementById('summaryDate').textContent = formatDateBR(selectedDate);
        document.getElementById('summaryTime').textContent = "Selecione o horário";
        summaryDiv.style.display = 'block';
    } else {
        summaryDiv.style.display = 'none';
    }
}

bookingTimeSelect.addEventListener('change', updateSummary);

// Processar Formulário de Agendamento
bookingForm.onsubmit = function(e) {
    e.preventDefault();
    
    const name = document.getElementById('clientName').value;
    const phone = document.getElementById('clientPhone').value;
    const address = document.getElementById('clientAddress').value;
    const service = document.getElementById('selectedService').value;
    const price = document.getElementById('selectedPrice').value;
    const time = bookingTimeSelect.value;

    if (!name || !phone || !address || !selectedDate || !time) {
        alert('Por favor, preencha todos os campos obrigatórios e selecione uma data e horário.');
        return;
    }

    const dateStr = formatDateISO(selectedDate);
    const dateDisplay = formatDateBR(selectedDate);

    // Confirmar agendamento
    const confirmMsg = `Confirmar agendamento para ${service} em ${dateDisplay} às ${time}?`;
    if (!confirm(confirmMsg)) return;

    // Salvar no localStorage
    const appointments = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
    
    const isOccupied = appointments.some(app => app.date === dateStr && app.time === time);
    if (isOccupied) {
        alert('Desculpe, este horário acabou de ser ocupado. Por favor, escolha outro.');
        updateAvailableTimes();
        return;
    }

    const newAppointment = {
        name, phone, address, service, price, 
        date: dateStr, 
        dateDisplay: dateDisplay,
        time,
        timestamp: new Date().toISOString()
    };
    
    appointments.push(newAppointment);
    localStorage.setItem('yas_femme_appointments', JSON.stringify(appointments));

    // Gerar mensagem para WhatsApp
    const message = `Olá! Gostaria de confirmar meu agendamento no Yas Femme Studio:

👤 Nome: ${name}
📱 Telefone: ${phone}
📍 Endereço: ${address}

💅 Serviço: ${service}
💰 Valor: R$ ${price}
📅 Data: ${dateDisplay}
⏰ Horário: ${time}

Aguardo confirmação!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedMessage}`;

    // Redirecionar para WhatsApp
    window.open(whatsappUrl, '_blank');
    
    alert('Agendamento realizado com sucesso! Você será redirecionado para o WhatsApp para confirmação final.');
    closeBookingModal();
};
