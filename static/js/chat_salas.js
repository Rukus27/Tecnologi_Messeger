// static/js/chat_salas.js

// Configuración
const socket = io();
let currentUser = null;
let currentRoom = null;
let isTyping = false;
let typingTimer = null;

// Elementos DOM
const joinSection = document.getElementById('joinSection');
const chatSection = document.getElementById('chatSection');
const roomNameInput = document.getElementById('roomName');
const joinBtn = document.getElementById('joinBtn');
const currentRoomSpan = document.getElementById('currentRoom');
const roomTitle = document.getElementById('roomTitle');
const userCountSpan = document.getElementById('userCount');
const leaveBtn = document.getElementById('leaveBtn');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');
const currentUserSpan = document.getElementById('currentUser');
const logoutBtn = document.getElementById('logoutBtn');

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    cargarUsuarioActual();
    configurarEventListeners();
});

// Cargar usuario desde localStorage
function cargarUsuarioActual() {
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = '/login';
        return;
    }
    
    currentUser = JSON.parse(userData);
    currentUserSpan.textContent = currentUser.nombre;
}

// Configurar event listeners
function configurarEventListeners() {
    // Unirse a sala
    joinBtn.addEventListener('click', unirseASala);
    roomNameInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') unirseASala();
    });
    
    // Enviar mensaje
    sendBtn.addEventListener('click', enviarMensaje);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            enviarMensaje();
            return;
        }
        
        // Indicador de escritura
        if (!isTyping) {
            socket.emit('typing', { is_typing: true, room: currentRoom });
            isTyping = true;
        }
        
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
            socket.emit('typing', { is_typing: false, room: currentRoom });
            isTyping = false;
        }, 1000);
    });
    
    // Salir de sala
    leaveBtn.addEventListener('click', salirDeSala);
    
    // Logout
    logoutBtn.addEventListener('click', cerrarSesion);
}

// Unirse a una sala
function unirseASala() {
    const roomName = roomNameInput.value.trim();
    
    if (!roomName) {
        alert('Por favor ingresa un nombre de sala');
        return;
    }
    
    if (roomName.length < 2 || roomName.length > 30) {
        alert('El nombre de la sala debe tener entre 2 y 30 caracteres');
        return;
    }
    
    currentRoom = roomName.toLowerCase();
    
    console.log("🔄 Intentando unirse a sala:", {
        username: currentUser.nombre,
        room: currentRoom,
        socketId: socket.id
    });
    
    // Unirse al chat - ENVIAR DATOS EXPLÍCITAMENTE
    socket.emit('join_chat', { 
        username: currentUser.nombre, 
        room: currentRoom 
    });
    
    // Cambiar interfaz inmediatamente (feedback visual)
    joinSection.classList.add('hidden');
    chatSection.classList.remove('hidden');
    currentRoomSpan.textContent = currentRoom;
    
    // Limpiar mensajes anteriores
    messagesContainer.innerHTML = `
        <div class="system-message">
            🔄 Conectando a la sala "${currentRoom}"...
        </div>
    `;
    
    messageInput.focus();
}

// Enviar mensaje
function enviarMensaje() {
    const message = messageInput.value.trim();
    if (!message || !currentRoom) return;
    
    socket.emit('send_message', { 
        message: message,
        room: currentRoom
    });
    
    messageInput.value = '';
    
    // Detener indicador de escritura
    if (isTyping) {
        socket.emit('typing', { is_typing: false, room: currentRoom });
        isTyping = false;
    }
    
    messageInput.focus();
}

// Salir de la sala
function salirDeSala() {
    if (currentRoom) {
        socket.emit('leave_room', { room: currentRoom });
    }
    
    currentRoom = null;
    chatSection.classList.add('hidden');
    joinSection.classList.remove('hidden');
    roomNameInput.value = '';
    roomNameInput.focus();
}

// Cerrar sesión
function cerrarSesion() {
    if (currentRoom) {
        salirDeSala();
    }
    
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// ================= SOCKET.IO EVENTOS =================

// Conectado al servidor
socket.on('connect', () => {
    console.log('✅ Conectado al servidor de chat, Socket ID:', socket.id);
});

// Desconectado
socket.on('disconnect', () => {
    console.log('❌ Desconectado del servidor');
});

// Mensaje del sistema
socket.on('system', (data) => {
    console.log('📢 Mensaje del sistema:', data.message);
    agregarMensajeSistema(data.message);
});

// Nuevo mensaje de chat
socket.on('new_message', (data) => {
    console.log('💬 Nuevo mensaje:', data);
    const isOwnMessage = data.username === currentUser.nombre;
    agregarMensajeChat(data, isOwnMessage);
});

// Usuarios en la sala
socket.on('room_users', (data) => {
    console.log('👥 Usuarios en sala:', data.users);
    userCountSpan.textContent = `${data.users.length} usuarios`;
});

// Usuario escribiendo
socket.on('user_typing', (data) => {
    console.log('⌨️ Usuario escribiendo:', data);
    if (data.is_typing) {
        typingText.textContent = data.username;
        typingIndicator.classList.remove('hidden');
    } else {
        typingIndicator.classList.add('hidden');
    }
});

// Error
socket.on('error', (data) => {
    console.error('❌ Error del servidor:', data);
    alert(`Error: ${data.message}`);
});
// ================= FUNCIONES AUXILIARES =================

// Agregar mensaje del sistema
function agregarMensajeSistema(mensaje) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = mensaje;
    messagesContainer.appendChild(div);
    scrollToBottom();
}

// Agregar mensaje de chat
function agregarMensajeChat(data, isOwnMessage) {
    const div = document.createElement('div');
    div.className = `message ${isOwnMessage ? 'own' : 'other'}`;
    
    const tiempo = new Date().toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    div.innerHTML = `
        <div class="message-header">
            <span class="message-user">${escapeHtml(data.username)}</span>
            <span class="message-time">${tiempo}</span>
        </div>
        <div class="message-text">${escapeHtml(data.message)}</div>
    `;
    
    messagesContainer.appendChild(div);
    scrollToBottom();
    
    // Ocultar indicador de escritura
    typingIndicator.classList.add('hidden');
}

// Scroll al final
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}