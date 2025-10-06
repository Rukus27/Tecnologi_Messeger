from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import datetime
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import secrets
import re
from functools import wraps


#Nombre de la base de datos
DB_PATH = "BaseDatos_TP.db"


app = Flask(__name__)
#PARTE CRITICA, ESTO CAMBIA LA CLAVE DE UNA ALEATEORIA Y SEGURA
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['SESSION_COOKIE_SECURE'] = True # SOLO HTTPS en produccion
app.config['SESSION_COOKIE_HTTPONLY'] = True # PROTEGE CONTRA XSS   
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
socketio = SocketIO(app, cors_allowed_origins="*")



def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

# Almacenar usuarios conectados en memoria
connected_users = {}
active_rooms = {}

# RUTAS WEB
@app.route('/')
def index():
    return render_template('login.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

@app.route('/register2')
def register2_page():
    return render_template('register2.html')


@app.route('/dashboard')
def dashboard_page():
    """Página principal después del login"""
    return render_template('dashboard.html')

@app.route('/chat')
def chat_page():
    return render_template('index.html')

@app.route('/chat/menu')
def chat_menu_page():
    return render_template('chat_menu.html')

@app.route('/chat/privado')
def chat_privado_page():
    return render_template('chat_privado.html')

@app.route('/chat/salas')
def chat_salas_page():
    """Página del chat por salas"""
    return render_template('chat_salas.html')

@app.route('/proyectos')
def proyectos_page():
    return render_template('proyectos.html')



# ---------------------------
# API REST
# ---------------------------

# API para registro de usuarios
@app.route("/api/register", methods=["POST"])
def register_user():
    try:
        data = request.get_json()
        nombre = data.get("nombre", "").strip()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")
        area = data.get("area", "")
        github = data.get("github")

        if not all([nombre, email, password, area]):
            return jsonify({"success": False, "message": "Todos los campos son obligatorios"}), 400

        if "@techpaint.com" not in email:
            return jsonify({"success": False, "message": "Debes usar email corporativo"}), 400

        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO usuarios (nombre, email, password, area, github_username) VALUES (?, ?, ?, ?, ?)",
            (nombre, email, password, area, github))
        
        conn.commit()
        user_id = cur.lastrowid
        conn.close()

        return jsonify({"success": True, "message": "Usuario creado exitosamente", "user_id": user_id})
    except sqlite3.IntegrityError:
        return jsonify({"success": False, "message": "El correo ya está registrado"}), 409
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


# API para login
@app.route('/api/login', methods=['POST'])
def login_user():
    try:
        data = request.get_json()
        email = data.get("email", "").strip().lower()
        password = data.get("password", "")

        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT * FROM usuarios WHERE email=? AND password=?", (email, password))
        user = cur.fetchone()
        conn.close()

        if user:
            return jsonify({
                "success": True,
                "message": "Login exitoso",
                "user": {
                    "id": user["id"],
                    "nombre": user["nombre"],
                    "email": user["email"],
                    "area": user["area"],
                    "github_username": user["github_username"]
                }
            })
        else:
            return jsonify({"success": False, "message": "Credenciales incorrectas"}), 401
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/proyectos', methods=['GET'])
def get_proyectos():
    """Obtener todos los proyectos con info de usuario"""
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT p.*, u.nombre as usuario_nombre, u.area as usuario_area,
               (SELECT COUNT(*) FROM votos WHERE proyecto_id = p.id AND tipo = 'like') as likes,
               (SELECT COUNT(*) FROM votos WHERE proyecto_id = p.id AND tipo = 'dislike') as dislikes
        FROM proyectos p
        JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY p.fecha_publicacion DESC
    """)
    proyectos = cur.fetchall()
    conn.close()
    
    return jsonify({
        "success": True,
        "proyectos": [dict(proj) for proj in proyectos]
    })

@app.route('/api/proyectos', methods=['POST'])
def crear_proyecto():
    """Crear nuevo proyecto"""
    try:
        data = request.get_json()
        user_id = data.get('usuario_id')
        titulo = data.get('titulo')
        descripcion = data.get('descripcion')
        github_url = data.get('github_url')
        tecnologias = data.get('tecnologias')
        
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO proyectos (usuario_id, titulo, descripcion, github_url, tecnologias)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, titulo, descripcion, github_url, tecnologias))
        
        conn.commit()
        proyecto_id = cur.lastrowid
        conn.close()
        
        return jsonify({"success": True, "proyecto_id": proyecto_id})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    

@app.route('/api/proyectos/<int:proyecto_id>/votar', methods=['POST'])
def votar_proyecto(proyecto_id):
    """Like/Dislike a proyecto"""
    try:
        data = request.get_json()
        usuario_id = data.get('usuario_id')
        tipo = data.get('tipo')  # 'like' o 'dislike'
        
        conn = get_db()
        cur = conn.cursor()
        
        # Verificar si ya votó
        cur.execute("SELECT id, tipo FROM votos WHERE proyecto_id = ? AND usuario_id = ?", 
                   (proyecto_id, usuario_id))
        voto_existente = cur.fetchone()
        
        if voto_existente:
            if voto_existente['tipo'] == tipo:
                # Quitar voto
                cur.execute("DELETE FROM votos WHERE id = ?", (voto_existente['id'],))
            else:
                # Cambiar voto
                cur.execute("UPDATE votos SET tipo = ? WHERE id = ?", (tipo, voto_existente['id']))
        else:
            # Nuevo voto
            cur.execute("INSERT INTO votos (proyecto_id, usuario_id, tipo) VALUES (?, ?, ?)",
                       (proyecto_id, usuario_id, tipo))
        
        conn.commit()
        
        # Obtener conteos actualizados
        cur.execute("SELECT COUNT(*) as count FROM votos WHERE proyecto_id = ? AND tipo = 'like'", (proyecto_id,))
        likes = cur.fetchone()['count']
        
        cur.execute("SELECT COUNT(*) as count FROM votos WHERE proyecto_id = ? AND tipo = 'dislike'", (proyecto_id,))
        dislikes = cur.fetchone()['count']
        
        conn.close()
        
        return jsonify({
            "success": True, 
            "likes": likes, 
            "dislikes": dislikes,
            "user_vote": tipo if not voto_existente or voto_existente['tipo'] != tipo else None
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    

    
@app.route('/api/proyectos/<int:proyecto_id>/comentarios', methods=['GET'])
def get_comentarios(proyecto_id):
    """Obtener comentarios de un proyecto"""
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT c.*, u.nombre as usuario_nombre
        FROM comentarios c
        JOIN usuarios u ON c.usuario_id = u.id
        WHERE c.proyecto_id = ?
        ORDER BY c.fecha ASC
    """, (proyecto_id,))
    
    comentarios = cur.fetchall()
    conn.close()
    
    return jsonify({
        "success": True,
        "comentarios": [dict(com) for com in comentarios]
    })




@app.route('/api/proyectos/<int:proyecto_id>/comentarios', methods=['POST'])
def agregar_comentario(proyecto_id):
    """Agregar comentario a proyecto"""
    try:
        data = request.get_json()
        usuario_id = data.get('usuario_id')
        comentario = data.get('comentario')
        
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO comentarios (proyecto_id, usuario_id, comentario)
            VALUES (?, ?, ?)
        """, (proyecto_id, usuario_id, comentario))
        
        conn.commit()
        comentario_id = cur.lastrowid
        
        # Obtener info del comentario recién creado
        cur.execute("""
            SELECT c.*, u.nombre as usuario_nombre
            FROM comentarios c
            JOIN usuarios u ON c.usuario_id = u.id
            WHERE c.id = ?
        """, (comentario_id,))
        
        nuevo_comentario = dict(cur.fetchone())
        conn.close()
        
        return jsonify({
            "success": True, 
            "comentario": nuevo_comentario
        })
        
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500





@app.route('/api/usuarios')
def get_usuarios():
    """Obtener todos los usuarios excepto el actual"""
    exclude_id = request.args.get('exclude')
    conn = get_db()
    cur = conn.cursor()
    
    query = "SELECT id, nombre, email, area FROM usuarios"
    params = []
    
    if exclude_id:
        query += " WHERE id != ?"
        params.append(exclude_id)
    
    cur.execute(query, params)
    usuarios = cur.fetchall()
    conn.close()
    
    return jsonify({
        "success": True,
        "usuarios": [dict(user) for user in usuarios]
    })

# Mantén este endpoint y elimina el duplicado
@app.route('/api/conversaciones/<int:user_id>')
def get_conversaciones(user_id):
    """Obtener conversaciones del usuario"""
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT DISTINCT 
            CASE 
                WHEN mp.remitente_id = ? THEN mp.destinatario_id
                ELSE mp.remitente_id
            END as id,
            u.nombre as nombre,
            u.area as area,
            (SELECT mensaje FROM mensajes_privados 
             WHERE ((remitente_id = ? AND destinatario_id = id) 
                    OR (remitente_id = id AND destinatario_id = ?))
             ORDER BY fecha DESC LIMIT 1) as ultimo_mensaje,
            (SELECT COUNT(*) FROM mensajes_privados 
             WHERE destinatario_id = ? AND remitente_id = id AND leido = 0) as no_leidos
        FROM mensajes_privados mp
        JOIN usuarios u ON u.id = CASE 
            WHEN mp.remitente_id = ? THEN mp.destinatario_id
            ELSE mp.remitente_id
        END
        WHERE mp.remitente_id = ? OR mp.destinatario_id = ?
        GROUP BY id
        ORDER BY (SELECT fecha FROM mensajes_privados 
                 WHERE ((remitente_id = ? AND destinatario_id = id) 
                        OR (remitente_id = id AND destinatario_id = ?))
                 ORDER BY fecha DESC LIMIT 1) DESC
    """, (user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id, user_id))
    
    conversaciones = cur.fetchall()
    conn.close()
    
    return jsonify({
        "success": True,
        "conversaciones": [dict(conv) for conv in conversaciones]
    })

@app.route('/api/mensajes/<int:user_id>/<int:contacto_id>')
def get_mensajes_privados(user_id, contacto_id):
    """Obtener mensajes entre dos usuarios"""
    conn = get_db()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT mp.*, u.nombre as remitente_nombre
        FROM mensajes_privados mp
        JOIN usuarios u ON mp.remitente_id = u.id
        WHERE (mp.remitente_id = ? AND mp.destinatario_id = ?)
           OR (mp.remitente_id = ? AND mp.destinatario_id = ?)
        ORDER BY mp.fecha ASC
    """, (user_id, contacto_id, contacto_id, user_id))
    
    mensajes = cur.fetchall()
    conn.close()
    
    return jsonify({
        "success": True,
        "mensajes": [dict(msg) for msg in mensajes]
    })

@app.route('/api/mensajes/leer', methods=['POST'])
def marcar_mensajes_leidos():
    """Marcar mensajes como leídos"""
    try:
        data = request.get_json()
        usuario_id = data.get('usuario_id')
        remitente_id = data.get('remitente_id')
        
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            UPDATE mensajes_privados 
            SET leido = 1 
            WHERE destinatario_id = ? AND remitente_id = ? AND leido = 0
        """, (usuario_id, remitente_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500




# ---------------------------
# Eventos de Socket.IO (chat)
# ---------------------------

@socketio.on('connect')
def on_connect():
    print(f'Cliente conectado: {request.sid}')
    emit('system', {'message': 'Conectado al servidor de chat'})

@socketio.on('disconnect')
def on_disconnect():
    user_id = request.sid
    if user_id in connected_users:
        user_data = connected_users[user_id]
        username = user_data.get('username', 'Usuario')
        room = user_data.get('room')
        
        if room:
            leave_room(room)
            emit('system', {
                'message': f'{username} se ha desconectado'
            }, to=room)
        
        del connected_users[user_id]
    
    print(f'Cliente desconectado: {request.sid}')

@socketio.on('join_chat')
def on_join(data):
    try:
        print(f"=== JOIN_CHAT EVENT RECEIVED ===")
        print(f"Data received: {data}")
        print(f"Socket ID: {request.sid}")
        print(f"Data type: {type(data)}")
        
        username = data.get('username', 'Anónimo')
        room = data.get('room', 'general')
        
        print(f"Username extracted: {username}")
        print(f"Room extracted: {room}")
        
        # Validar datos
        if not username or not room:
            print("ERROR: Missing username or room")
            emit('error', {'message': 'Faltan datos de usuario o sala'})
            return
            
        sid = request.sid

        # Guardar usuario conectado
        connected_users[sid] = {
            'username': username, 
            'room': room, 
            'joined_at': datetime.now()
        }
        
        # Unirse a la sala
        join_room(room)
        
        print(f"✅ User {username} joined room {room}")
        print(f"Total connected users: {len(connected_users)}")

        # Notificar a la sala
        emit('system', {
            'message': f'{username} se ha unido a la sala'
        }, to=room)
        
        # Confirmar al usuario
        emit('system', {
            'message': f'Conectado como {username} en la sala "{room}"'
        })

        # Actualizar lista de usuarios en la sala
        room_users = []
        for uid, udata in connected_users.items():
            if udata.get('room') == room:
                room_users.append(udata.get('username'))
        
        print(f"Users in room {room}: {room_users}")
        
        emit('room_users', {'users': room_users}, to=room)
        
    except Exception as e:
        print(f"❌ ERROR in join_chat: {str(e)}")
        emit('error', {'message': f'Error al unirse: {str(e)}'})

@socketio.on('send_message')
def on_message(data):
    try:
        sid = request.sid
        user_map = connected_users.get(sid)
        # Fallback: si no encontramos room en mapping, usar room enviado por cliente
        room = None
        if user_map:
            room = user_map.get('room')
        if not room:
            room = data.get('room')  # fallback (no confíes en esto para seguridad)
        message_text = (data.get('message') or '').strip()

        if not sid or not message_text or not room:
            emit('error', {'message': 'Falta sid, sala o mensaje.'})
            return

        username = user_map.get('username') if user_map else data.get('username', 'Anónimo')

        message_data = {
            'username': username,
            'message': message_text,
            'timestamp': datetime.now().isoformat(),
            'sender_id': sid
        }

        print(f"[MSG] sid={sid} username={username} room={room} message={message_text}")

        emit('new_message', message_data, to=room)
    except Exception as e:
        emit('error', {'message': f'Error enviando mensaje: {str(e)}'})

@socketio.on('typing')
def on_typing(data):
    user_id = request.sid
    if user_id in connected_users:
        user_data = connected_users[user_id]
        room = user_data.get('room')
        username = user_data.get('username')
        
        emit('user_typing', {
            'username': username,
            'is_typing': data.get('is_typing', False)
        }, to=room, include_self=False)

@socketio.on('leave_room')
def on_leave_room():
    user_id = request.sid
    if user_id in connected_users:
        user_data = connected_users[user_id]
        username = user_data.get('username', 'Usuario')
        room = user_data.get('room')
        
        if room:
            # Salir de la sala
            leave_room(room)
            
            # Notificar a la sala que el usuario se fue
            emit('system', {
                'message': f'{username} ha salido de la sala'
            }, to=room)
            
            # Actualizar lista de usuarios en la sala
            room_users = []
            for uid, udata in connected_users.items():
                if uid != user_id and udata.get('room') == room:
                    room_users.append(udata.get('username'))
            
            emit('room_users', {'users': room_users}, to=room)
            
            # Remover usuario de la lista de conectados
            del connected_users[user_id]
            
            # Confirmar al usuario que salió
            emit('left_room', {'message': 'Has salido de la sala exitosamente'})
            
            print(f'{username} salió de la sala {room}')
    else:
        emit('error', {'message': 'No estás en ninguna sala'})


# Agregar a app.py después de los otros eventos de socket
connected_private_users = {}  # {user_id: sid}

@socketio.on('join_private_chat')
def join_private_chat(data):
    user_id = data.get('userId')
    connected_private_users[user_id] = request.sid
    print(f"Usuario {user_id} conectado al chat privado")

@socketio.on('send_private_message')
def send_private_message(data):
    remitente_id = data.get('remitenteId')
    destinatario_id = data.get('destinatarioId')
    mensaje = data.get('mensaje')

    # Guardar en DB
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO mensajes_privados(remitente_id, destinatario_id, mensaje)
        VALUES (?, ?, ?)
    """, (remitente_id, destinatario_id, mensaje))
    conn.commit()
    
    # Obtener el ID del mensaje recién insertado
    mensaje_id = cur.lastrowid
    
    # Obtener información completa del mensaje
    cur.execute("""
        SELECT mp.*, u.nombre as remitente_nombre
        FROM mensajes_privados mp
        JOIN usuarios u ON mp.remitente_id = u.id
        WHERE mp.id = ?
    """, (mensaje_id,))
    
    mensaje_completo = dict(cur.fetchone())
    conn.close()

    mensaje_data = {
        "id": mensaje_completo['id'],
        "remitente_id": remitente_id,
        "destinatario_id": destinatario_id,
        "mensaje": mensaje,
        "fecha": mensaje_completo['fecha'],
        "leido": mensaje_completo['leido']
    }

    # SOLUCIÓN: Enviar solo al destinatario, NO al remitente
    sid_dest = connected_private_users.get(destinatario_id)
    if sid_dest:
        emit('new_private_message', mensaje_data, to=sid_dest)

@socketio.on('typing_private')
def typing_private(data):
    user_id = data.get('userId')
    destinatario_id = data.get('destinatarioId')
    sid_dest = connected_private_users.get(destinatario_id)
    if sid_dest:
        emit('user_typing_private', {"userId": user_id}, to=sid_dest)

@socketio.on('stop_typing_private')
def stop_typing_private(data):
    user_id = data.get('userId')
    destinatario_id = data.get('destinatarioId')
    sid_dest = connected_private_users.get(destinatario_id)
    if sid_dest:
        emit('user_stop_typing_private', {"userId": user_id}, to=sid_dest)

# Obtener conversaciones del usuario
@app.route("/api/conversaciones/<int:user_id>")
def obtener_conversaciones(user_id):
    try:
        conn = get_db()
        cur = conn.cursor()
        # Último mensaje por cada contacto
        cur.execute("""
            SELECT u.id AS id, u.nombre, u.area, u.email,
                   mp.mensaje AS ultimo_mensaje,
                   SUM(CASE WHEN mp.leido = 0 AND mp.destinatario_id = ? THEN 1 ELSE 0 END) AS no_leidos
            FROM usuarios u
            LEFT JOIN mensajes_privados mp 
                ON (u.id = mp.remitente_id AND mp.destinatario_id = ?)
                OR (u.id = mp.destinatario_id AND mp.remitente_id = ?)
            WHERE u.id != ?
            GROUP BY u.id
            ORDER BY MAX(mp.fecha) DESC
        """, (user_id, user_id, user_id, user_id))
        conversaciones = [dict(row) for row in cur.fetchall()]
        conn.close()
        return jsonify({"success": True, "conversaciones": conversaciones})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Obtener mensajes de una conversación
@app.route("/api/mensajes/<int:user_id>/<int:contacto_id>")
def obtener_mensajes(user_id, contacto_id):
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT * FROM mensajes_privados
            WHERE (remitente_id = ? AND destinatario_id = ?)
               OR (remitente_id = ? AND destinatario_id = ?)
            ORDER BY fecha ASC
        """, (user_id, contacto_id, contacto_id, user_id))
        mensajes = [dict(row) for row in cur.fetchall()]
        conn.close()
        return jsonify({"success": True, "mensajes": mensajes})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# Marcar mensajes como leídos
@app.route("/api/marcar-leidos", methods=["POST"])
def marcar_leidos():
    try:
        data = request.get_json()
        usuario_id = data["usuarioId"]
        destinatario_id = data["destinatarioId"]

        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            UPDATE mensajes_privados
            SET leido = 1
            WHERE remitente_id = ? AND destinatario_id = ? AND leido = 0
        """, (destinatario_id, usuario_id))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500








if __name__ == '__main__':
    print("servidor TechPaint Flask...")
    print("Chat disponible en: http://130.10.1.23:5050")
    socketio.run(app, debug=True, host='130.10.1.23', port=5050)
