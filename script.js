// Configurações e Dados
const WHATSAPP_NUMBER = "557381676132";
const DURATION_HOURS = 2;

// Elementos do DOM
const modal = document.getElementById('bookingModal');
const bookingForm = document.getElementById('bookingForm');
const bookingDaySelect = document.getElementById('bookingDay');
const bookingTimeSelect = document.getElementById('bookingTime');
const summaryDiv = document.getElementById('bookingSummary');

// Abrir Modal de Agendamento
function openBookingModal(serviceName, price) {
    document.getElementById('selectedService').value = serviceName;
    document.getElementById('selectedPrice').value = price;
    
    // Atualizar resumo inicial
    document.getElementById('summaryService').textContent = serviceName;
    document.getElementById('summaryPrice').textContent = price;
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevenir scroll do fundo
}

// Fechar Modal
function closeBookingModal() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    bookingForm.reset();
    summaryDiv.style.display = 'none';
    bookingTimeSelect.disabled = true;
}

// Fechar modal ao clicar fora dele
window.onclick = function(event) {
    if (event.target == modal) {
        closeBookingModal();
    }
}

// Lógica de Horários Disponíveis
function updateAvailableTimes() {
    const selectedDay = bookingDaySelect.value;
    bookingTimeSelect.innerHTML = '<option value="">Selecione um horário...</option>';
    
    if (!selectedDay) {
        bookingTimeSelect.disabled = true;
        summaryDiv.style.display = 'none';
        return;
    }

    bookingTimeSelect.disabled = false;
    
    let times = [];
    const isWeekend = (selectedDay === 'Sábado' || selectedDay === 'Domingo');
    
    if (isWeekend) {
        // Sábado e Domingo: 09h, 11h, 13h, 15h, 17h, 19h, 21h
        times = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
    } else {
        // Segunda a Sexta: 19h, 21h
        times = ['19:00', '21:00'];
    }

    // Obter agendamentos do localStorage
    const appointments = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
    
    times.forEach(time => {
        // Verificar se o horário já está ocupado para aquele dia
        const isOccupied = appointments.some(app => app.day === selectedDay && app.time === time);
        
        const option = document.createElement('option');
        option.value = time;
        option.textContent = time;
        
        if (isOccupied) {
            option.disabled = true;
            option.textContent += ' (Ocupado)';
        }
        
        bookingTimeSelect.appendChild(option);
    });

    updateSummary();
}

// Atualizar Resumo do Agendamento
function updateSummary() {
    const day = bookingDaySelect.value;
    const time = bookingTimeSelect.value;
    
    if (day && time) {
        document.getElementById('summaryDay').textContent = day;
        document.getElementById('summaryTime').textContent = time;
        summaryDiv.style.display = 'block';
    } else {
        summaryDiv.style.display = 'none';
    }
}

// Event listeners para atualizar resumo
bookingDaySelect.addEventListener('change', updateSummary);
bookingTimeSelect.addEventListener('change', updateSummary);

// Processar Formulário de Agendamento
bookingForm.onsubmit = function(e) {
    e.preventDefault();
    
    const name = document.getElementById('clientName').value;
    const phone = document.getElementById('clientPhone').value;
    const address = document.getElementById('clientAddress').value;
    const service = document.getElementById('selectedService').value;
    const price = document.getElementById('selectedPrice').value;
    const day = bookingDaySelect.value;
    const time = bookingTimeSelect.value;

    if (!name || !phone || !address || !day || !time) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }

    // Confirmar agendamento
    const confirmMsg = `Confirmar agendamento para ${service} na ${day} às ${time}?`;
    if (!confirm(confirmMsg)) return;

    // Salvar no localStorage
    const appointments = JSON.parse(localStorage.getItem('yas_femme_appointments') || '[]');
    
    // Verificação dupla de segurança (concorrência local)
    const isOccupied = appointments.some(app => app.day === day && app.time === time);
    if (isOccupied) {
        alert('Desculpe, este horário acabou de ser ocupado. Por favor, escolha outro.');
        updateAvailableTimes();
        return;
    }

    const newAppointment = {
        name, phone, address, service, price, day, time,
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
📅 Data: ${day}
⏰ Horário: ${time}

Aguardo confirmação!`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodedMessage}`;

    // Redirecionar para WhatsApp
    window.open(whatsappUrl, '_blank');
    
    // Fechar modal e resetar
    alert('Agendamento realizado com sucesso! Você será redirecionado para o WhatsApp para confirmação final.');
    closeBookingModal();
};
