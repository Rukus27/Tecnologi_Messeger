// static/js/chat.js (reemplazar)

// Inicialización del socket
const socket = io();

// Elementos DOM
const joinBox = document.getElementById('joinBox');
const chatBox = document.getElementById('chatBox');
const joinBtn = document.getElementById('joinBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const usernameInput = document.getElementById('username');
const roomInput = document.getElementById('room');
const headerInfo = document.getElementById('headerInfo');
const messagesDiv = document.getElementById('messages');
const msgInput = document.getElementById('msgInput');
const sendBtn = document.getElementById('sendBtn');
const onlineUsers = document.getElementById('onlineUsers');
const typingIndicator = document.getElementById('typingIndicator');
const typingText = document.getElementById('typingText');

  // Estado
  let currentRoom = null;
  let currentUsername = null;
  let typingTimer = null;
  let isTyping = false;

  // Cargar usuario desde localStorage (espera que login guarde key "user")
  try {
    const savedUserObj = localStorage.getItem("user");
    if (!savedUserObj) {
      // No hay sesión -> redirigir
      console.warn("No hay sesión activa. Redirigiendo al login...");
      window.location.href = "/login";
      return;
    }
    const savedUser = JSON.parse(savedUserObj);
    currentUsername = savedUser.nombre || savedUser.name || savedUser.email || "Usuario";
  } catch (err) {
    console.error("Error leyendo usuario de localStorage:", err);
    window.location.href = "/login";
    return;
  }

  // Helpers
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  function formatTime(iso) {
    if (!iso) return new Date().toLocaleTimeString();
    return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  function appendMessage(content, className = '') {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${className}`;
    messageEl.innerHTML = content;
    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  function showTyping(username) {
    typingText.textContent = `${username} está escribiendo...`;
    typingIndicator.classList.remove('hidden');
  }
  function hideTyping() {
    typingIndicator.classList.add('hidden');
  }

  // --- Handlers de UI ---

  // Join: el usuario solo escribe la sala; el nombre ya viene de login
  if (joinBtn) {
    console.log('Botón de unirse encontrado y configurado');
    joinBtn.addEventListener('click', () => {
      console.log('Botón de unirse clickeado');
      const room = (roomInput && roomInput.value || '').trim().toLowerCase();
      console.log('Sala ingresada:', room);
      if (!room) {
        alert('Por favor ingresa el nombre de la sala');
        return;
      }
      if (room.length < 2 || room.length > 30) {
        alert('El nombre de la sala debe tener entre 2 y 30 caracteres');
        return;
      }

      currentRoom = room;

      // Emitir join_chat (servidor guardará request.sid -> room)
      socket.emit('join_chat', { username: currentUsername, room });

      // UI
      if (joinBox) joinBox.classList.add('hidden');
      if (chatBox) chatBox.classList.remove('hidden');
      if (headerInfo) headerInfo.innerHTML = `<span class="status-dot"></span> <strong>${escapeHtml(currentUsername)}</strong> en <em>${escapeHtml(room)}</em>`;
      if (msgInput) msgInput.focus();
    });
  }

  // Enviar mensaje (incluimos campo room para redundancia)
  function sendMessage() {
    if (!msgInput) return;
    const message = msgInput.value.trim();
    if (!message) return;
    if (!currentRoom) {
      alert("No estás en ninguna sala. Únete primero.");
      return;
    }

    // Enviamos sala para fallback; servidor usará su mapping por seguridad
    socket.emit('send_message', { room: currentRoom, message, username: currentUsername });
    msgInput.value = '';

    if (isTyping) {
      socket.emit('typing', { is_typing: false });
      isTyping = false;
    }
    msgInput.focus();
  }
  if (sendBtn) sendBtn.addEventListener('click', sendMessage);

  // Enter para enviar
  if (msgInput) {
    msgInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
        return;
      }
      if (!isTyping) {
        socket.emit('typing', { is_typing: true });
        isTyping = true;
      }
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => {
        socket.emit('typing', { is_typing: false });
        isTyping = false;
      }, 1000);
    });

    msgInput.addEventListener('blur', () => {
      if (isTyping) {
        socket.emit('typing', { is_typing: false });
        isTyping = false;
      }
    });
  }

  // Leave
  if (leaveRoomBtn) {
    leaveRoomBtn.addEventListener('click', () => {
      if (!currentRoom) {
        // nada que hacer
        if (joinBox) { joinBox.classList.remove('hidden'); chatBox.classList.add('hidden'); }
        return;
      }
      if (!confirm('¿Estás seguro de que quieres salir de la sala?')) return;
      socket.emit('leave_room', { room: currentRoom }); // podemos enviar room como ayuda
      // limpiar UI
      currentRoom = null;
      isTyping = false;
      clearTimeout(typingTimer);
      if (messagesDiv) messagesDiv.innerHTML = '';
      if (chatBox) chatBox.classList.add('hidden');
      if (joinBox) joinBox.classList.remove('hidden');
      if (roomInput) roomInput.focus();
    });
  }

  // --- Socket events ---
  socket.on('connect', () => {
    console.log('Socket conectado, id=', socket.id);
  });

  socket.on('disconnect', () => {
    console.warn('Socket desconectado');
    appendMessage(`<strong>Conexión perdida</strong>`, 'system error');
  });

  socket.on('system', (data) => {
    appendMessage(`<em>${escapeHtml(data.message)}</em>`, 'system');
  });

  socket.on('new_message', (data) => {
    // data: { username, message, timestamp, sender_id }
    // Determinar si es propio: comparar sender_id con socket.id O username con currentUsername
    const isOwn = (data.sender_id && data.sender_id === socket.id) || (data.username && data.username === currentUsername);
    const time = formatTime(data.timestamp);
    const content = `<div class="message-header"><strong>${escapeHtml(data.username)}</strong><span class="time">${time}</span></div><div class="message-text">${escapeHtml(data.message)}</div>`;
    appendMessage(content, isOwn ? 'own' : 'other');
    hideTyping();
  });

  socket.on('room_users', (data) => {
    const users = data.users || [];
    onlineUsers.innerHTML = `<div class="users-label">En línea (${users.length}):</div>` + users.map(u => `<span class="user-pill">${escapeHtml(u)}</span>`).join('');
  });

  socket.on('user_typing', (data) => {
    if (data.is_typing) showTyping(data.username); else hideTyping();
  });

  socket.on('left_room', (data) => {
    appendMessage(`<em>${escapeHtml(data.message)}</em>`, 'system success');
  });

  socket.on('error', (d) => {
    console.error('Socket error:', d);
    appendMessage(`<strong>Error:</strong> ${escapeHtml(d.message || JSON.stringify(d))}`, 'system error');
  });

  // focus en input de sala al cargar la página (si existe)
  if (roomInput) roomInput.focus();

