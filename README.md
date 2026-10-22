# Butaca — aplicación web de películas

Butaca es una aplicación escolar para descubrir películas populares, buscar por
título, aplicar filtros y consultar detalles con información de TMDB. También
permite guardar favoritos en el navegador.

## Capturas de pantalla

Agrega tus capturas en `docs/capturas/` y actualiza estos marcadores:

<!-- TODO: agrega una captura de la pantalla principal. -->
![Pantalla principal de Butaca](docs/capturas/inicio.png)

<!-- TODO: agrega una captura del detalle de una película. -->
![Detalle de película](docs/capturas/detalle.png)

<!-- TODO: agrega una captura de la vista de favoritos. -->
![Vista de favoritos](docs/capturas/favoritos.png)

## Características

- Catálogo de películas populares de TMDB.
- Búsqueda por título mientras se escribe y al enviar el formulario.
- Filtros por género y orden: popularidad, mejor calificadas y más recientes.
- Paginación con el botón **Cargar más**.
- Diálogo de detalle con sinopsis, reparto y tráiler cuando está disponible.
- Favoritos persistentes en `localStorage`, sin solicitudes adicionales a TMDB.
- Estados accesibles de carga, error y lista vacía; soporte de teclado.
- Interfaz responsive en español de México y preferencia por movimiento reducido.
- Modo de demostración para probar estados de error sin modificar la clave.

## Tecnologías

- HTML semántico.
- CSS nativo.
- JavaScript puro (sin frameworks, dependencias ni herramientas de build).
- API TMDB v3.

## Requisitos

- Navegador moderno con JavaScript habilitado.
- Una cuenta de TMDB y una clave de API v3.
- Un servidor estático local para cargar la aplicación, por ejemplo Live Server
  en VS Code o Python 3.

## Instalación y ejecución

1. Clona el repositorio y entra a la carpeta del proyecto:

   ```bash
   git clone https://github.com/JulianKu12/App-Web-de-Peliculas.git
   cd App-Web-de-Peliculas
   ```

2. Crea una cuenta en [TMDB](https://www.themoviedb.org/signup) e inicia sesión.
   Solicita una clave API v3 en la sección
   [API de la configuración de tu cuenta](https://www.themoviedb.org/settings/api).
   TMDB puede pedir información sobre el uso de la API antes de aprobarla.

3. Desde la raíz del proyecto, copia el archivo de ejemplo:

   ```bash
   # Windows PowerShell
   Copy-Item js/config.example.js js/config.js
   ```

   En macOS o Linux puedes usar:

   ```bash
   cp js/config.example.js js/config.js
   ```

4. Abre `js/config.js` en tu editor y reemplaza `TU_API_KEY_AQUI` con tu clave.
   Conserva el resto de las propiedades y no compartas ni publiques este archivo.

5. Ejecuta la aplicación usando **Live Server** desde `index.html`, o inicia el
   servidor estático de Python en la raíz del proyecto:

   ```bash
   python -m http.server 8000
   ```

   Abre <http://localhost:8000> en el navegador. Para detener Python, vuelve a
   la terminal y presiona `Ctrl+C`.

## Estructura del proyecto

```text
.
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── config.example.js
│   └── config.js          # local; ignorado por Git
├── .gitignore
├── index.html
└── README.md
```

`js/config.js` se crea localmente durante la instalación y está excluido por
`.gitignore`. El repositorio incluye únicamente `js/config.example.js`, que
contiene el marcador de posición para la clave.

## Manejo de errores

Las solicitudes se centralizan en `fetchTMDB`. La aplicación detecta falta de
conexión, timeout de 10 segundos, clave inválida (401), recurso no encontrado
(404), límite de solicitudes (429), errores de servidor (5xx), respuestas no
válidas y búsquedas sin resultados. Los mensajes visibles son amigables y están
en español; los detalles técnicos se envían a la consola. En una respuesta 429
se aplican hasta dos reintentos con espera basada en `Retry-After` o demora
exponencial. Cuando corresponde, la interfaz presenta un botón para reintentar.
La aplicación avisa al perder conexión y, si hubo un error de red, vuelve a
intentar la última acción al reconectarse.

### Modo de demostración

Agrega uno de estos parámetros a la URL local para mostrar el estado indicado:

| Parámetro | Resultado simulado |
| --- | --- |
| `?simular=offline` | Error de conexión |
| `?simular=429` | Límite de solicitudes, reintentos y cuenta regresiva |
| `?simular=401` | Clave de API inválida |
| `?simular=500` | Error del servidor |
| `?simular=vacio` | Búsqueda o catálogo sin resultados |

Ejemplo: <http://localhost:8000/?simular=401>. Quita el parámetro de la URL para
volver al comportamiento normal. El modo demo fuerza respuestas simuladas desde
la aplicación y no cambia la configuración local.

## Seguridad de la clave API

Esta aplicación se ejecuta íntegramente en el navegador y envía la clave de TMDB
como parámetro de las solicitudes. Por ello, la clave puede ser visible para las
personas que inspeccionen el código o el tráfico de red; `.gitignore` evita
subir `js/config.js` por accidente, pero **no oculta la clave a quienes usan la
aplicación**. Para un sitio público, usa un backend que mantenga la clave en el
servidor y aplica las restricciones disponibles en TMDB. No publiques la clave
real en repositorios, capturas ni mensajes.

## Créditos y atribución

Los datos de películas son proporcionados por [The Movie Database
(TMDB)](https://www.themoviedb.org/).

> Este producto usa la API de TMDB pero no está respaldado ni certificado por TMDB.

## Lista de comprobación de pruebas manuales

- [ ] **Populares:** abre la página principal y confirma que carga películas y
  que el título de la sección es “Películas populares”.
- [ ] **Búsqueda:** busca un título conocido; confirma que aparecen resultados
  y que el encabezado refleja el texto buscado.
- [ ] **Búsqueda sin resultados:** busca una combinación improbable y verifica
  el mensaje vacío con la sugerencia de probar otro título.
- [ ] **Filtros:** selecciona un género y prueba los tres órdenes; confirma que
  la lista y el encabezado se actualizan. Escribe una búsqueda y verifica que
  los filtros se deshabilitan; limpia la búsqueda para reactivarlos.
- [ ] **Cargar más:** desplázate hasta el botón, actívalo y confirma que agrega
  películas sin quitar las anteriores; verifica que se oculta al llegar al final.
- [ ] **Detalle:** abre una tarjeta con clic y con teclado (Enter/Espacio);
  verifica información, reparto, sinopsis, tráiler disponible y cierre con
  botón, `Esc` y clic fuera.
- [ ] **Favoritos:** agrega y quita películas desde tarjeta y detalle; revisa el
  contador, entra y sal de Favoritos, recarga para verificar persistencia y
  comprueba el estado vacío al eliminar el último favorito.
- [ ] **Modo sin conexión:** desactiva la red del dispositivo y comprueba el
  aviso; con `?simular=offline`, verifica también el mensaje de error y el
  reintento al recuperar conexión.
- [ ] **Límite de solicitudes:** abre `?simular=429`; revisa los reintentos, la
  cuenta regresiva y el botón **Reintentar**.
- [ ] **Clave inválida:** abre `?simular=401` y confirma el mensaje de
  configuración de clave.
- [ ] **Clave sin configurar:** reemplaza temporalmente `js/config.js` por una
  copia del ejemplo (o cambia la clave a `TU_API_KEY_AQUI`) y verifica el
  mensaje para configurarla. Restaura tu archivo local con la clave real al
  terminar; no lo agregues ni lo compartas.
- [ ] **Responsive:** revisa la página y el diálogo en anchos de 360, 768 y
  1280 px; confirma que no haya desbordamiento horizontal y que los controles
  sigan siendo utilizables.
