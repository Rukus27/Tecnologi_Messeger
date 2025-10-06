// Inicialización
const socket = io();
let currentUser = null;
let currentChat = null;
let conversaciones = [];
let typingTimer = null;

// Obtener usuario actual de localStorage
document.addEventListener('DOMContentLoaded', function() {
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = '/login';
        return;
    }
    
    currentUser = JSON.parse(userData);
    document.getElementById('currentUserName').textContent = currentUser.nombre;
    
    // Conectar al servidor
    socket.emit('join_private_chat', { userId: currentUser.id });
    
    // Cargar conversaciones
    cargarConversaciones();
    
    // Cargar usuarios disponibles
    cargarUsuariosDisponibles();
});

// Elementos DOM
const conversacionesLista = document.getElementById('conversacionesLista');
const noConversacion = document.getElementById('noConversacion');
const chatActivo = document.getElementById('chatActivo');
const mensajesContenedor = document.getElementById('mensajesContenedor');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const btnNuevoChat = document.getElementById('btnNuevoChat');
const modalNuevoChat = document.getElementById('modalNuevoChat');
const modalClose = document.getElementById('modalClose');
const btnCerrarChat = document.getElementById('btnCerrarChat');

// Cargar conversaciones del usuario
async function cargarConversaciones() {
    try {
        const response = await fetch(`/api/conversaciones/${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            conversaciones = data.conversaciones;
            renderConversaciones();
        }
    } catch (error) {
        console.error('Error cargando conversaciones:', error);
    }
}

// Renderizar lista de conversaciones
function renderConversaciones() {
    conversacionesLista.innerHTML = '';
    
    if (conversaciones.length === 0) {
        conversacionesLista.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">No tienes conversaciones aún</p>';
        return;
    }
    
    conversaciones.forEach(conv => {
        const div = document.createElement('div');
        div.className = 'conversacion-item';
        if (conv.no_leidos > 0) {
            div.classList.add('unread');
        }
        if (currentChat && currentChat.id === conv.id) {
            div.classList.add('active');
        }
        
        div.innerHTML = `
            <div class="conversacion-nombre">${conv.nombre}</div>
            <div class="ultimo-mensaje">${conv.ultimo_mensaje || 'Sin mensajes'}</div>
        `;
        
        div.onclick = () => abrirConversacion(conv);
        conversacionesLista.appendChild(div);
    });
}

// Abrir conversación
async function abrirConversacion(conv) {
    currentChat = conv;
    renderConversaciones(); // Re-renderizar para marcar activa
    
    // Mostrar chat activo
    noConversacion.classList.add('hidden');
    chatActivo.classList.remove('hidden');
    
    // Actualizar header del chat
    document.getElementById('destinatarioNombre').textContent = conv.nombre;
    document.getElementById('destinatarioArea').textContent = conv.area;
    
    // Obtener inicial para avatar
    const inicial = conv.nombre.charAt(0).toUpperCase();
    document.querySelector('.avatar').textContent = inicial;
    
    // Cargar mensajes
    await cargarMensajes(conv.id);
    
    // Marcar como leídos
    marcarComoLeidos(conv.id);
}

// Cargar mensajes de una conversación
async function cargarMensajes(destinatarioId) {
    try {
        const response = await fetch(`/api/mensajes/${currentUser.id}/${destinatarioId}`);
        const data = await response.json();
        
        if (data.success) {
            renderMensajes(data.mensajes);
        }
    } catch (error) {
        console.error('Error cargando mensajes:', error);
    }
}

// Renderizar mensajes
function renderMensajes(mensajes) {
    mensajesContenedor.innerHTML = '';
    
    if (mensajes.length === 0) {
        mensajesContenedor.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No hay mensajes aún. ¡Envía el primero!</p>';
        return;
    }
    
    mensajes.forEach(msg => {
        const div = document.createElement('div');
        const esEnviado = msg.remitente_id === currentUser.id;
        div.className = `mensaje ${esEnviado ? 'enviado' : 'recibido'}`;
        
        const fecha = new Date(msg.fecha);
        const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        div.innerHTML = `
            <div>${msg.mensaje}</div>
            <div class="mensaje-hora">${hora}</div>
        `;
        
        mensajesContenedor.appendChild(div);
    });
    
    // Scroll al final
    mensajesContenedor.scrollTop = mensajesContenedor.scrollHeight;
}

// Enviar mensaje - MEJORADA
function enviarMensaje() {
    const mensaje = messageInput.value.trim();
    if (!mensaje || !currentChat) return;
    
    // Crear objeto de mensaje para mostrar inmediatamente
    const mensajeData = {
        remitente_id: currentUser.id,
        destinatario_id: currentChat.id,
        mensaje: mensaje,
        fecha: new Date().toISOString()
    };
    
    // Mostrar el mensaje inmediatamente en la UI
    agregarMensajeALaVista(mensajeData);
    
    // Enviar al servidor
    socket.emit('send_private_message', {
        remitenteId: currentUser.id,
        destinatarioId: currentChat.id,
        mensaje: mensaje
    });
    
    messageInput.value = '';
    
    // Detener indicador de escritura
    socket.emit('stop_typing_private', {
        userId: currentUser.id,
        destinatarioId: currentChat.id
    });
    
    // Actualizar conversaciones después de un breve delay
    setTimeout(() => {
        cargarConversaciones();
    }, 100);
}

sendBtn.addEventListener('click', enviarMensaje);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        enviarMensaje();
        return;
    }
    
    // Indicador de escritura
    clearTimeout(typingTimer);
    socket.emit('typing_private', {
        userId: currentUser.id,
        destinatarioId: currentChat.id
    });
    
    typingTimer = setTimeout(() => {
        socket.emit('stop_typing_private', {
            userId: currentUser.id,
            destinatarioId: currentChat.id
        });
    }, 1000);
});

// Eventos de Socket.IO
// Mensaje recibido de otro usuario
socket.on('new_private_message', (data) => {
    if (data.remitente_id !== currentUser.id && currentChat && currentChat.id === data.remitente_id) {
        agregarMensajeALaVista(data);
        marcarComoLeidos(data.remitente_id);
    }
    cargarConversaciones();
});

// Mensaje enviado por el usuario actual
socket.on('message_sent', (data) => {
    if (currentChat && currentChat.id === data.destinatario_id) {
        agregarMensajeALaVista(data);
    }
    cargarConversaciones();
});

socket.on('user_typing_private', (data) => {
    if (currentChat && data.userId === currentChat.id) {
        document.getElementById('typingUsername').textContent = currentChat.nombre;
        document.getElementById('typingIndicator').classList.remove('hidden');
    }
});

socket.on('user_stop_typing_private', (data) => {
    if (currentChat && data.userId === currentChat.id) {
        document.getElementById('typingIndicator').classList.add('hidden');
    }
});

// Marcar mensajes como leídos
async function marcarComoLeidos(destinatarioId) {
    try {
        await fetch('/api/marcar-leidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                usuarioId: currentUser.id,
                destinatarioId: destinatarioId
            })
        });
    } catch (error) {
        console.error('Error marcando como leídos:', error);
    }
}

// Modal nuevo chat
btnNuevoChat.addEventListener('click', () => {
    modalNuevoChat.classList.remove('hidden');
});

modalClose.addEventListener('click', () => {
    modalNuevoChat.classList.add('hidden');
});

modalNuevoChat.addEventListener('click', (e) => {
    if (e.target === modalNuevoChat) {
        modalNuevoChat.classList.add('hidden');
    }
});

// Cargar usuarios disponibles
async function cargarUsuariosDisponibles() {
    try {
        const response = await fetch(`/api/usuarios?exclude=${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            renderUsuariosDisponibles(data.usuarios);
        }
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}


// Renderizar usuarios disponibles
function renderUsuariosDisponibles(usuarios) {
    const container = document.getElementById('usuariosDisponibles');
    const searchInput = document.getElementById('buscarNuevoUsuario');
    
    function renderList(usuariosFiltrados) {
        container.innerHTML = '';
        
        if (usuariosFiltrados.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No se encontraron usuarios</p>';
            return;
        }
        
        usuariosFiltrados.forEach(usuario => {
            // Verificar si ya existe conversación con este usuario
            const conversacionExistente = conversaciones.find(conv => 
                conv.id === usuario.id
            );
            
            const div = document.createElement('div');
            div.className = 'usuario-item';
            div.innerHTML = `
                <div class="usuario-nombre">${usuario.nombre}</div>
                <div class="usuario-email">${usuario.email}</div>
                ${conversacionExistente ? '<div class="conversacion-existente">(Conversación existente)</div>' : ''}
            `;
            
            div.onclick = () => {
                iniciarNuevoChat(usuario);
            };

            container.appendChild(div);
        });
    }
    
    // Renderizar lista inicial
    renderList(usuarios);
    
    // Filtrar usuarios en tiempo real
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = usuarios.filter(user => 
            user.nombre.toLowerCase().includes(searchTerm) || 
            user.email.toLowerCase().includes(searchTerm)
        );
        renderList(filteredUsers);
    });
}


// Iniciar nuevo chat
async function iniciarNuevoChat(usuario) {
    try {
        // Verificar si ya existe una conversación
        const conversacionExistente = conversaciones.find(conv => conv.id === usuario.id);
        
        if (conversacionExistente) {
            // Abrir conversación existente
            abrirConversacion(conversacionExistente);
        } else {
            // Crear nueva conversación en el frontend
            const nuevaConversacion = {
                id: usuario.id,
                nombre: usuario.nombre,
                area: usuario.area || 'Sin área',
                ultimo_mensaje: null,
                no_leidos: 0
            };
            
            conversaciones.unshift(nuevaConversacion);
            renderConversaciones();
            abrirConversacion(nuevaConversacion);
        }
        
        // Cerrar modal
        modalNuevoChat.classList.add('hidden');
        document.getElementById('buscarNuevoUsuario').value = '';
        
    } catch (error) {
        console.error('Error iniciando nuevo chat:', error);
        alert('Error al iniciar el chat');
    }
}

// Cerrar chat activo
btnCerrarChat.addEventListener('click', () => {
    currentChat = null;
    chatActivo.classList.add('hidden');
    noConversacion.classList.remove('hidden');
    renderConversaciones();
});

// Buscar en conversaciones existentes
document.getElementById('searchUser').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredConversations = conversaciones.filter(conv => 
        conv.nombre.toLowerCase().includes(searchTerm)
    );
    
    renderFilteredConversaciones(filteredConversations);
});

function renderFilteredConversaciones(conversacionesFiltradas) {
    conversacionesLista.innerHTML = '';
    
    if (conversacionesFiltradas.length === 0) {
        conversacionesLista.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">No se encontraron conversaciones</p>';
        return;
    }
    
    conversacionesFiltradas.forEach(conv => {
        const div = document.createElement('div');
        div.className = 'conversacion-item';
        if (conv.no_leidos > 0) {
            div.classList.add('unread');
        }
        if (currentChat && currentChat.id === conv.id) {
            div.classList.add('active');
        }
        
        div.innerHTML = `
            <div class="conversacion-nombre">${conv.nombre}</div>
            <div class="ultimo-mensaje">${conv.ultimo_mensaje || 'Sin mensajes'}</div>
        `;
        
        div.onclick = () => abrirConversacion(conv);
        conversacionesLista.appendChild(div);
    });
}

// Notificaciones de nuevos mensajes
function mostrarNotificacion(mensaje, conversacion) {
    if (!document.hasFocus() || !currentChat || currentChat.id !== conversacion.id) {
        // Mostrar notificación del navegador
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(`Nuevo mensaje de ${conversacion.nombre}`, {
                body: mensaje.mensaje.substring(0, 50) + '...',
                icon: '/static/img/icon.png'
            });
        }
    }
}


// Función mejorada para agregar mensajes
function agregarMensajeALaVista(data) {
    // Verificar si el mensaje ya existe para evitar duplicados
    const mensajesExistentes = mensajesContenedor.querySelectorAll('.mensaje');
    for (let msg of mensajesExistentes) {
        if (msg.textContent.includes(data.mensaje)) {
            console.log('Mensaje duplicado detectado, ignorando');
            return;
        }
    }
    
    const div = document.createElement('div');
    const esEnviado = data.remitente_id === currentUser.id;
    div.className = `mensaje ${esEnviado ? 'enviado' : 'recibido'}`;
    
    const fecha = new Date(data.fecha || new Date());
    const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    div.innerHTML = `
        <div>${data.mensaje}</div>
        <div class="mensaje-hora">${hora}</div>
    `;
    
    mensajesContenedor.appendChild(div);
    mensajesContenedor.scrollTop = mensajesContenedor.scrollHeight;
}
// Evento para mensajes enviados por mí
socket.on('message_sent', (data) => {
    if (currentChat && data.destinatario_id === currentChat.id) {
        agregarMensajeALaVista(data);
    }
    cargarConversaciones();
});

// Evento para mensajes recibidos de otros
socket.on('new_private_message', (data) => {
    // Solo procesar mensajes recibidos de otros
    if (data.remitente_id === currentUser.id) return;
    
    if (currentChat && data.remitente_id === currentChat.id) {
        agregarMensajeALaVista(data);
        marcarComoLeidos(currentChat.id);
    } else {
        const conversacion = conversaciones.find(conv => conv.id === data.remitente_id);
        if (conversacion) {
            mostrarNotificacion(data, conversacion);
        }
    }
    cargarConversaciones();
});

// Solicitar permisos para notificaciones
if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
}

// Manejar conexión/desconexión
socket.on('connect', () => {
    console.log('Conectado al servidor de chat');
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor de chat');
});

// Limpiar timers al salir
window.addEventListener('beforeunload', () => {
    if (typingTimer) {
        clearTimeout(typingTimer);
    }
    if (currentChat) {
        socket.emit('stop_typing_private', {
            userId: currentUser.id,
            destinatarioId: currentChat.id
        });
    }
});

// Mejorar el evento keypress para mejor UX
messageInput.addEventListener('input', (e) => {
    // Indicador de escritura solo si hay texto
    if (e.target.value.trim()) {
        clearTimeout(typingTimer);
        socket.emit('typing_private', {
            userId: currentUser.id,
            destinatarioId: currentChat.id
        });
        
        typingTimer = setTimeout(() => {
            socket.emit('stop_typing_private', {
                userId: currentUser.id,
                destinatarioId: currentChat.id
            });
        }, 1000);
    }
});


// Función para mostrar notificaciones toast
function mostrarNotificacionToast(mensaje, tipo = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.textContent = mensaje;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Detectar conexión/desconexión
socket.on('connect', () => {
    mostrarNotificacionToast('🟢 Conectado al chat', 'success');
});

socket.on('disconnect', () => {
    mostrarNotificacionToast('🔴 Desconectado del servidor', 'error');
});

// Mejorar la experiencia móvil
function initMobileFeatures() {
    const floatingBtn = document.createElement('button');
    floatingBtn.className = 'floating-action';
    floatingBtn.innerHTML = '💬';
    floatingBtn.title = 'Abrir conversaciones';
    document.body.appendChild(floatingBtn);
    
    const overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    document.body.appendChild(overlay);
    
    floatingBtn.addEventListener('click', () => {
        document.querySelector('.conversaciones-panel').classList.add('mobile-open');
        overlay.classList.add('active');
    });
    
    overlay.addEventListener('click', () => {
        document.querySelector('.conversaciones-panel').classList.remove('mobile-open');
        overlay.classList.remove('active');
    });
}

// Inicializar características móviles
if (window.innerWidth <= 768) {
    initMobileFeatures();
}