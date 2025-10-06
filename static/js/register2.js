// Verificar que haya datos del paso 1
const step1Data = sessionStorage.getItem('registerStep1');
if (!step1Data) {
    window.location.href = '/register';
}

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

// Manejar formulario paso 2
document.getElementById('step2Form').addEventListener('submit', async function(e) {
    e.preventDefault();
    clearAlert();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const password2 = document.getElementById('password2').value;
    const github = document.getElementById('github').value.trim();
    
    // Validaciones
    if (!email || !password || !password2) {
        showAlert('Por favor completa todos los campos obligatorios', true);
        return;
    }
    
    if (password !== password2) {
        showAlert('Las contraseñas no coinciden', true);
        return;
    }
    
    if (password.length < 8) {
        showAlert('La contraseña debe tener al menos 8 caracteres', true);
        return;
    }
    
    if (!email.includes('@techpaint.com')) {
        showAlert('Debes usar tu email corporativo (@techpaint.com)', true);
        return;
    }
    
    // Obtener datos del paso 1
    const datosStep1 = JSON.parse(sessionStorage.getItem('registerStep1'));
    
    // Combinar todos los datos
    const fullData = {
        nombre: `${datosStep1.nombre} ${datosStep1.apellido}`,
        email: email,
        area: datosStep1.area,
        password: password,
        github: github || null
    };
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(fullData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showAlert('Cuenta creada exitosamente. Redirigiendo al login...');
            
            // Limpiar sessionStorage
            sessionStorage.removeItem('registerStep1');
            
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        } else {
            showAlert(result.message, true);
        }
        
    } catch (error) {
        console.error('Error en registro:', error);
        showAlert('Error de conexión. Intenta nuevamente.', true);
    }
});

// Validación de email corporativo en tiempo real
document.getElementById('email').addEventListener('blur', function() {
    const email = this.value.trim();
    if (email && !email.includes('@techpaint.com')) {
        this.style.borderColor = '#ff4444';
        this.title = 'Debes usar tu email corporativo (@techpaint.com)';
    } else {
        this.style.borderColor = '#666';
        this.title = '';
    }
});

// Validación de coincidencia de contraseñas
document.getElementById('password2').addEventListener('input', function() {
    const password = document.getElementById('password').value;
    const password2 = this.value;
    
    if (password2 && password !== password2) {
        this.style.borderColor = '#ff4444';
    } else {
        this.style.borderColor = '#666';
    }
});

// Validación de longitud de contraseña
document.getElementById('password').addEventListener('input', function() {
    if (this.value.length > 0 && this.value.length < 8) {
        this.style.borderColor = '#ff4444';
        this.title = 'La contraseña debe tener al menos 8 caracteres';
    } else {
        this.style.borderColor = '#666';
        this.title = '';
    }
});