// Conectar al servidor de Socket.IO
const socket = io('http://localhost:3000');

// Elementos del DOM
const messagesArea = document.getElementById('messagesArea');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');

// Usuario actual (normalmente vendría de un sistema de autenticación)
const currentUser = {
    username: 'Rukus27',
    avatar: 'https://avatars.githubusercontent.com/Rukus27'
};

// Formatear fecha
function formatDate(date) {
    return new Date(date).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Crear elemento de mensaje
function createMessageElement(message, isSent = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const messageContent = `
        <div class="sender">${message.username}</div>
        <div class="content">${message.text}</div>
        <div class="time">${formatDate(message.timestamp)}</div>
    `;
    
    messageDiv.innerHTML = messageContent;
    return messageDiv;
}

// Añadir mensaje al área de chat
function addMessage(message, isSent = false) {
    const messageElement = createMessageElement(message, isSent);
    messagesArea.appendChild(messageElement);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// Manejar envío de mensaje
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    if (messageInput.value.trim()) {
        const message = {
            username: currentUser.username,
            text: messageInput.value,
            timestamp: new Date(),
        };

        // Emitir mensaje al servidor
        socket.emit('chat message', message);
        
        // Añadir mensaje a la interfaz
        addMessage(message, true);
        
        // Limpiar input
        messageInput.value = '';
    }
});

// Escuchar mensajes entrantes
socket.on('chat message', (message) => {
    if (message.username !== currentUser.username) {
        addMessage(message);
    }
});

// Notificaciones de conexión
socket.on('user connected', (username) => {
    const message = {
        username: 'Sistema',
        text: `${username} se ha conectado`,
        timestamp: new Date()
    };
    addMessage(message);
});

socket.on('user disconnected', (username) => {
    const message = {
        username: 'Sistema',
        text: `${username} se ha desconectado`,
        timestamp: new Date()
    };
    addMessage(message);
});

// Manejar estado de conexión
socket.on('connect', () => {
    console.log('Conectado al servidor');
    socket.emit('user connected', currentUser.username);
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor');
});