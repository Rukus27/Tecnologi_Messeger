// static/js/proyectos.js

// Variables globales
let currentUser = null;
let proyectos = [];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    cargarUsuarioActual();
    cargarProyectos();
    configurarEventos();
});

// Cargar usuario desde localStorage
function cargarUsuarioActual() {
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = '/login';
        return;
    }
    
    currentUser = JSON.parse(userData);
    document.getElementById('currentUser').textContent = `Hola, ${currentUser.nombre}`;
}

// Configurar event listeners
function configurarEventos() {
    // Formulario de nuevo proyecto
    document.getElementById('projectForm').addEventListener('submit', crearProyecto);
    
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', cerrarSesion);
}

// Cargar proyectos desde la API
async function cargarProyectos() {
    try {
        const response = await fetch('/api/proyectos');
        const data = await response.json();
        
        if (data.success) {
            proyectos = data.proyectos;
            renderProyectos();
        } else {
            mostrarError('Error al cargar proyectos');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error de conexión');
    }
}

// Renderizar proyectos en el feed
function renderProyectos() {
    const feed = document.getElementById('projectsFeed');
    
    if (proyectos.length === 0) {
        feed.innerHTML = `
            <div class="empty-state">
                <div class="icon">📁</div>
                <h3>No hay proyectos aún</h3>
                <p>Sé el primero en compartir un proyecto</p>
            </div>
        `;
        return;
    }
    
    feed.innerHTML = proyectos.map(proyecto => crearCardProyecto(proyecto)).join('');
    
    // Agregar event listeners a los botones de votos y comentarios
    agregarEventListenersProyectos();
}

// Crear HTML para un proyecto
function crearCardProyecto(proyecto) {
    const fecha = new Date(proyecto.fecha_publicacion).toLocaleDateString('es-ES');
    const tecnologias = proyecto.tecnologias ? proyecto.tecnologias.split(',').map(tech => tech.trim()) : [];
    
    return `
        <div class="project-card" data-project-id="${proyecto.id}">
            <div class="project-header">
                <div class="project-user">
                    <div class="user-avatar">
                        ${proyecto.usuario_nombre.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-info-small">
                        <h4>${escapeHtml(proyecto.usuario_nombre)}</h4>
                        <p class="user-area">${escapeHtml(proyecto.usuario_area)}</p>
                    </div>
                </div>
                <div class="project-date">${fecha}</div>
            </div>
            
            <h3 class="project-title">${escapeHtml(proyecto.titulo)}</h3>
            
            ${proyecto.descripcion ? `
                <p class="project-description">${escapeHtml(proyecto.descripcion)}</p>
            ` : ''}
            
            ${tecnologias.length > 0 ? `
                <div class="project-tech">
                    ${tecnologias.map(tech => `
                        <span class="tech-tag">${escapeHtml(tech)}</span>
                    `).join('')}
                </div>
            ` : ''}
            
            <a href="${proyecto.github_url}" target="_blank" class="project-github">
                🔗 Ver en GitHub
            </a>
            
            <!-- Sistema de Votos -->
            <div class="voting-system">
                <button class="vote-btn like-btn ${proyecto.user_vote === 'like' ? 'active' : ''}" 
                        data-vote-type="like">
                    👍 <span class="vote-count">${proyecto.likes || 0}</span>
                </button>
                
                <button class="vote-btn dislike-btn ${proyecto.user_vote === 'dislike' ? 'active' : ''}" 
                        data-vote-type="dislike">
                    👎 <span class="vote-count">${proyecto.dislikes || 0}</span>
                </button>
                
                <button class="comment-toggle-btn" onclick="toggleComentarios(${proyecto.id})">
                    💬 Comentarios
                </button>
            </div>
            
            <!-- Sección de Comentarios (oculta inicialmente) -->
            <div class="comments-section" id="comments-${proyecto.id}" style="display: none;">
                <div class="comment-form">
                    <input type="text" class="comment-input" id="comment-input-${proyecto.id}" 
                           placeholder="Escribe un comentario..." maxlength="500">
                    <button onclick="agregarComentario(${proyecto.id})">Enviar</button>
                </div>
                <div class="comments-list" id="comments-list-${proyecto.id}">
                    <!-- Los comentarios se cargarán aquí -->
                </div>
            </div>
        </div>
    `;
}

// Agregar event listeners a los botones de proyectos
function agregarEventListenersProyectos() {
    // Botones de like/dislike
    document.querySelectorAll('.vote-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const projectId = this.closest('.project-card').dataset.projectId;
            const voteType = this.dataset.voteType;
            votarProyecto(projectId, voteType);
        });
    });
}

// Votar un proyecto
async function votarProyecto(projectId, voteType) {
    if (!currentUser) {
        mostrarError('Debes iniciar sesión para votar');
        return;
    }
    
    try {
        const response = await fetch(`/api/proyectos/${projectId}/votar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario_id: currentUser.id,
                tipo: voteType
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Actualizar los contadores en la UI
            const projectCard = document.querySelector(`[data-project-id="${projectId}"]`);
            const likeBtn = projectCard.querySelector('.like-btn');
            const dislikeBtn = projectCard.querySelector('.dislike-btn');
            const likeCount = likeBtn.querySelector('.vote-count');
            const dislikeCount = dislikeBtn.querySelector('.vote-count');
            
            likeCount.textContent = data.likes;
            dislikeCount.textContent = data.dislikes;
            
            // Actualizar estado activo
            likeBtn.classList.toggle('active', data.user_vote === 'like');
            dislikeBtn.classList.toggle('active', data.user_vote === 'dislike');
            
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al votar');
    }
}

// Crear nuevo proyecto
async function crearProyecto(e) {
    e.preventDefault();
    
    if (!currentUser) {
        mostrarError('Debes iniciar sesión');
        return;
    }
    
    const form = e.target;
    const titulo = document.getElementById('projectTitle').value.trim();
    const descripcion = document.getElementById('projectDesc').value.trim();
    const githubUrl = document.getElementById('projectGithub').value.trim();
    const tecnologias = document.getElementById('projectTech').value.trim();
    
    if (!titulo || !githubUrl) {
        mostrarError('Título y URL de GitHub son obligatorios');
        return;
    }
    
    try {
        const response = await fetch('/api/proyectos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario_id: currentUser.id,
                titulo: titulo,
                descripcion: descripcion,
                github_url: githubUrl,
                tecnologias: tecnologias
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            form.reset();
            mostrarExito('Proyecto publicado exitosamente');
            cargarProyectos(); // Recargar el feed
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al publicar proyecto');
    }
}

// Mostrar/ocultar comentarios
async function toggleComentarios(projectId) {
    const commentsSection = document.getElementById(`comments-${projectId}`);
    const commentsList = document.getElementById(`comments-list-${projectId}`);
    
    if (commentsSection.style.display === 'none') {
        // Cargar comentarios
        await cargarComentarios(projectId);
        commentsSection.style.display = 'block';
    } else {
        commentsSection.style.display = 'none';
    }
}

// Cargar comentarios de un proyecto
async function cargarComentarios(projectId) {
    try {
        const response = await fetch(`/api/proyectos/${projectId}/comentarios`);
        const data = await response.json();
        
        if (data.success) {
            renderComentarios(projectId, data.comentarios);
        }
    } catch (error) {
        console.error('Error cargando comentarios:', error);
    }
}

// Renderizar comentarios
function renderComentarios(projectId, comentarios) {
    const commentsList = document.getElementById(`comments-list-${projectId}`);
    
    if (comentarios.length === 0) {
        commentsList.innerHTML = '<p style="text-align: center; color: #666;">No hay comentarios aún</p>';
        return;
    }
    
    commentsList.innerHTML = comentarios.map(comentario => `
        <div class="comment">
            <div class="comment-header">
                <span class="comment-user">${escapeHtml(comentario.usuario_nombre)}</span>
                <span class="comment-date">${new Date(comentario.fecha).toLocaleDateString('es-ES')}</span>
            </div>
            <div class="comment-text">${escapeHtml(comentario.comentario)}</div>
        </div>
    `).join('');
}

// Agregar nuevo comentario
async function agregarComentario(projectId) {
    if (!currentUser) {
        mostrarError('Debes iniciar sesión para comentar');
        return;
    }
    
    const commentInput = document.getElementById(`comment-input-${projectId}`);
    const comentario = commentInput.value.trim();
    
    if (!comentario) {
        mostrarError('El comentario no puede estar vacío');
        return;
    }
    
    try {
        const response = await fetch(`/api/proyectos/${projectId}/comentarios`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                usuario_id: currentUser.id,
                comentario: comentario
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            commentInput.value = '';
            // Agregar el nuevo comentario a la lista
            const commentsList = document.getElementById(`comments-list-${projectId}`);
            const nuevoComentario = data.comentario;
            
            const commentHtml = `
                <div class="comment">
                    <div class="comment-header">
                        <span class="comment-user">${escapeHtml(nuevoComentario.usuario_nombre)}</span>
                        <span class="comment-date">${new Date(nuevoComentario.fecha).toLocaleDateString('es-ES')}</span>
                    </div>
                    <div class="comment-text">${escapeHtml(nuevoComentario.comentario)}</div>
                </div>
            `;
            
            commentsList.innerHTML += commentHtml;
            
        } else {
            mostrarError(data.message);
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarError('Error al agregar comentario');
    }
}

// Utilidades
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function mostrarError(mensaje) {
    // Puedes implementar un sistema de notificaciones más elegante
    alert(`Error: ${mensaje}`);
}

function mostrarExito(mensaje) {
    alert(`Éxito: ${mensaje}`);
}

function cerrarSesion() {
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Enviar comentario con Enter
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.target.classList.contains('comment-input')) {
        const projectId = e.target.id.split('-')[2];
        agregarComentario(projectId);
    }
});