// Funciones para mostrar alertas
function showAlert(message, isError = false) {
    const alertDiv = document.getElementById('registerAlert');
    if (alertDiv) {
        alertDiv.innerHTML = `<div class="alert ${isError ? 'error' : 'success'}">${message}</div>`;
    }
}

function clearAlert() {
    const alertDiv = document.getElementById('registerAlert');
    if (alertDiv) {
        alertDiv.innerHTML = '';
    }
}

// Manejar formulario paso 1
document.getElementById('step1Form').addEventListener('submit', function(e) {
    e.preventDefault();
    clearAlert();
    
    const nombre = document.getElementById('nombre').value.trim();
    const apellido = document.getElementById('apellido').value.trim();
    const area = document.getElementById('area').value;
    
    // Validaciones
    if (!nombre || !apellido || !area) {
        showAlert('Por favor completa todos los campos', true);
        return;
    }
    
    if (nombre.length < 2 || apellido.length < 2) {
        showAlert('Nombre y apellido deben tener al menos 2 caracteres', true);
        return;
    }
    
    // Guardar datos temporalmente en sessionStorage
    const step1Data = {
        nombre: nombre,
        apellido: apellido,
        area: area
    };
    
    sessionStorage.setItem('registerStep1', JSON.stringify(step1Data));
    
    // Redirigir al paso 2
    window.location.href = '/register2';
});

// Validación en tiempo real
document.getElementById('nombre').addEventListener('blur', function() {
    if (this.value.trim().length < 2 && this.value.trim().length > 0) {
        this.style.borderColor = '#ff4444';
    } else {
        this.style.borderColor = '#666';
    }
});

document.getElementById('apellido').addEventListener('blur', function() {
    if (this.value.trim().length < 2 && this.value.trim().length > 0) {
        this.style.borderColor = '#ff4444';
    } else {
        this.style.borderColor = '#666';
    }
});