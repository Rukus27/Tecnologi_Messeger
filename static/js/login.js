// Funciones para mostrar alertas
function showAlert(message, isError = false) {
    const alertDiv = document.getElementById('loginAlert');
    alertDiv.innerHTML = `<div class="alert ${isError ? 'error' : 'success'}">${message}</div>`;
}

function clearAlert() {
    const alertDiv = document.getElementById('loginAlert');
    alertDiv.innerHTML = '';
}

// Manejar formulario de login
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAlert();
    
    const formData = new FormData(e.target);
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Acceso exitoso. Redirigiendo...');
            
            // Guardar datos del usuario
            localStorage.setItem('user', JSON.stringify(result.user));
            
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 1500);
        } else {
            showAlert(result.message, true);
        }
        
    } catch (error) {
        console.error('Error en login:', error);
        showAlert('Error de conexión. Intenta nuevamente.', true);
    }
});

// Validación de email corporativo
document.getElementById('formUsuario').addEventListener('blur', function() {
    const email = this.value;
    if (email && !email.includes('@techpaint.com')) {
        this.style.borderColor = '#ff4444';
        this.title = 'Debes usar tu email corporativo (@techpaint.com)';
    } else {
        this.style.borderColor = '#666';
        this.title = '';
    }
});