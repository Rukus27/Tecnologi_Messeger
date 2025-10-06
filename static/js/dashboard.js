// static/js/dashboard.js

document.addEventListener('DOMContentLoaded', function() {
    cargarUsuarioActual();
    configurarEventos();
});

function cargarUsuarioActual() {
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = '/login';
        return;
    }
    
    const user = JSON.parse(userData);
    
    // Actualizar UI con información del usuario
    document.getElementById('userName').textContent = user.nombre;
    document.getElementById('userArea').textContent = user.area;
    document.getElementById('userInitial').textContent = user.nombre.charAt(0).toUpperCase();
}

function configurarEventos() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', cerrarSesion);
}

function cerrarSesion() {
    localStorage.removeItem('user');
    window.location.href = '/login';
}