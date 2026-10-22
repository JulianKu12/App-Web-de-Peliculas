# Aplicación web de películas

Proyecto escolar para explorar películas con datos de la API de TMDB.

## Modo de demostración de errores

Agrega uno de estos parámetros a la URL para probar los estados de la interfaz sin
modificar la configuración:

- `?simular=offline`: simula una pérdida de conexión.
- `?simular=429`: simula el límite de solicitudes y su cuenta regresiva.
- `?simular=401`: simula una clave de API inválida.
- `?simular=500`: simula un error del servidor.
- `?simular=vacio`: simula una consulta sin resultados.

Por ejemplo: `http://localhost:5500/?simular=429`. Quita el parámetro para volver
a las solicitudes normales de TMDB.
