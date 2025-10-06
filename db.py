import sqlite3

def crear_tablas():
    conexion = sqlite3.connect("BaseDatos_TP.db")  # Agregar .db
    cursor = conexion.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS usuarios(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        area TEXT NOT NULL,
        github_username TEXT
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS proyectos(  -- Corrección: TABLE, no TALBE
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        descripcion TEXT,
        github_url TEXT NOT NULL,
        tecnologias TEXT,
        fecha_publicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)  -- Corrección: FOREIGN
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS votos(  -- Faltaba paréntesis
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proyecto_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,  -- Corrección: usuario_id, no usuarios_id
        tipo TEXT CHECK(tipo IN ('like', 'dislike')),
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- Corrección: CURRENT_TIMESTAMP
        FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),  -- Corrección: FOREIGN
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
        UNIQUE(proyecto_id, usuario_id)
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS comentarios(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        proyecto_id INTEGER NOT NULL,
        usuario_id INTEGER NOT NULL,  -- Corrección: usuario_id
        comentario TEXT NOT NULL,  -- Corrección: comentario (singular)
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (proyecto_id) REFERENCES proyectos(id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)  -- Quitar coma final
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mensajes_privados(  -- Corrección: TABLE
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        remitente_id INTEGER NOT NULL,
        destinatario_id INTEGER NOT NULL,
        mensaje TEXT NOT NULL,
        leido BOOLEAN DEFAULT 0,  -- 0 = false en SQLite
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (remitente_id) REFERENCES usuarios(id),
        FOREIGN KEY (destinatario_id) REFERENCES usuarios(id)  -- Quitar coma final
    )
    """)
    
    conexion.commit()
    conexion.close()
    print("Base de datos creada exitosamente")

if __name__ == "__main__":
    crear_tablas()