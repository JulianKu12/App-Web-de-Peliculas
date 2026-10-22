// Constantes y referencias al DOM
const movieGrid = document.querySelector(".movie-grid");
const loadingState = document.querySelector(".state--loading");
const errorState = document.querySelector(".state--error");
const emptyState = document.querySelector(".state--empty");
const emptyMessage = emptyState.querySelector("p");
const sectionTitle = document.querySelector("#section-title");
const loadMoreButton = document.querySelector(".load-more");
const loadMoreWrap = document.querySelector(".load-more-wrap");
const movieDialog = document.querySelector(".movie-dialog");
const dialogContent = movieDialog.querySelector(".dialog-content");
const dialogCloseButton = movieDialog.querySelector(".dialog-close");
const connectionNotice = document.querySelector(".connection-notice");
const searchForm = document.querySelector(".search-form");
const searchInput = document.querySelector("#movie-search");
const genreFilter = document.querySelector("#genre-filter");
const sortFilter = document.querySelector("#sort-order");
const filterControls = document.querySelector(".filter-controls");
const favoritesToggle = document.querySelector(".favorites-toggle");
const favoritesCount = document.querySelector(".favorites-count");
const resultsAnnouncement = document.querySelector(".results-announcement");
const backToTopButton = document.querySelector(".back-to-top");
const FAVORITES_STORAGE_KEY = "butaca-favorites";

// Errores tipados de la aplicación
class AppError extends Error {
  constructor(type, message, options = {}) {
    super(message);
    this.name = "AppError";
    this.type = type;
    this.retryAfter = options.retryAfter ?? null;
  }
}

const ERROR_TYPES = {
  SIN_CONEXION: "SIN_CONEXION",
  TIMEOUT: "TIMEOUT",
  CLAVE_INVALIDA: "CLAVE_INVALIDA",
  NO_ENCONTRADO: "NO_ENCONTRADO",
  LIMITE_PETICIONES: "LIMITE_PETICIONES",
  ERROR_SERVIDOR: "ERROR_SERVIDOR",
  RESPUESTA_INVALIDA: "RESPUESTA_INVALIDA",
  SIN_RESULTADOS: "SIN_RESULTADOS"
};

const DEMO_MODE = new URLSearchParams(window.location.search).get("simular");

function getErrorPresentation(error) {
  const presentations = {
    [ERROR_TYPES.SIN_CONEXION]: {
      title: "Sin conexión",
      description: "Revisa tu conexión a internet e inténtalo de nuevo.",
      icon: "⌁",
      allowsRetry: true
    },
    [ERROR_TYPES.TIMEOUT]: {
      title: "La solicitud tardó demasiado",
      description: "El servicio está tardando en responder. Puedes intentarlo otra vez.",
      icon: "◷",
      allowsRetry: true
    },
    [ERROR_TYPES.CLAVE_INVALIDA]: {
      title: "No se pudo validar la clave de TMDB",
      description: "Verifica la clave API en js/config.js y vuelve a intentarlo.",
      icon: "!",
      allowsRetry: false
    },
    [ERROR_TYPES.NO_ENCONTRADO]: {
      title: "No encontramos ese contenido",
      description: "Puede que la película ya no esté disponible.",
      icon: "⌕",
      allowsRetry: false
    },
    [ERROR_TYPES.LIMITE_PETICIONES]: {
      title: "Hay muchas solicitudes en este momento",
      description: "Espera un momento antes de volver a intentarlo.",
      icon: "◷",
      allowsRetry: true
    },
    [ERROR_TYPES.ERROR_SERVIDOR]: {
      title: "TMDB no está disponible",
      description: "El servicio tuvo un problema. Inténtalo de nuevo más tarde.",
      icon: "!",
      allowsRetry: true
    },
    [ERROR_TYPES.RESPUESTA_INVALIDA]: {
      title: "No pudimos procesar la respuesta",
      description: "Revisa la configuración e inténtalo de nuevo.",
      icon: "!",
      allowsRetry: false
    },
    [ERROR_TYPES.SIN_RESULTADOS]: {
      title: "No encontramos películas",
      description: "Prueba con otro título o cambia los filtros.",
      icon: "⌕",
      allowsRetry: false
    }
  };

  return presentations[error.type] || presentations[ERROR_TYPES.RESPUESTA_INVALIDA];
}

const errorCountdowns = new WeakMap();

// Estado de la aplicación
const appState = {
  mode: "popular",
  page: 1,
  totalPages: 1,
  filters: {
    query: "",
    genre: "",
    sort: "popular"
  },
  movies: [],
  isLoading: false,
  requestId: 0,
  requestController: null,
  searchDebounce: null,
  detailRequestController: null,
  activeMovieId: null,
  detailOpener: null,
  previousBodyOverflow: "",
  hadConnectionError: false,
  connectionRetryAction: null,
  connectionErrorSource: null,
  favorites: loadFavorites()
};

function loadFavorites() {
  try {
    const storedFavorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    if (!Array.isArray(storedFavorites)) {
      throw new TypeError("Los favoritos guardados no tienen un formato válido.");
    }
    return storedFavorites
      .filter(movie =>
        movie
        && (typeof movie.id === "number" || typeof movie.id === "string")
        && typeof movie.title === "string"
        && (movie.poster_path === null || typeof movie.poster_path === "string")
        && typeof movie.release_date === "string"
        && Number.isFinite(Number(movie.vote_average))
      )
      .map(({ id, title, poster_path, release_date, vote_average }) => ({
        id,
        title,
        poster_path,
        release_date,
        vote_average: Number(vote_average)
      }));
  } catch (error) {
    console.error("No se pudieron leer los favoritos del almacenamiento local.", error);
    return [];
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(
      appState.favorites.map(({ id, title, poster_path, release_date, vote_average }) => ({
        id,
        title,
        poster_path: poster_path || null,
        release_date: release_date || "",
        vote_average: Number(vote_average) || 0
      }))
    ));
    return true;
  } catch (error) {
    console.error("No se pudieron guardar los favoritos en el almacenamiento local.", error);
    resultsAnnouncement.textContent = "No se pudieron guardar los cambios de favoritos en este dispositivo.";
    return false;
  }
}

function isFavorite(movieId) {
  return appState.favorites.some(movie => String(movie.id) === String(movieId));
}

function createFavoriteButton(movie) {
  const button = document.createElement("button");
  button.className = "favorite-button";
  button.type = "button";
  button.dataset.favoriteId = String(movie.id);
  updateFavoriteButton(button, movie);
  button.addEventListener("click", event => {
    event.stopPropagation();
    toggleFavorite(movie);
  });
  return button;
}

function updateFavoriteButton(button, movie) {
  const favorite = isFavorite(movie.id);
  button.setAttribute("aria-pressed", String(favorite));
  button.setAttribute(
    "aria-label",
    `${favorite ? "Quitar" : "Agregar"} ${movie.title} ${favorite ? "de" : "a"} favoritos`
  );
  button.textContent = favorite ? "♥" : "♡";
}

function updateFavoritesCount() {
  const count = appState.favorites.length;
  favoritesCount.textContent = String(count);
  favoritesCount.setAttribute("aria-label", `${count} ${count === 1 ? "favorito" : "favoritos"}`);
}

function toggleFavoritesView() {
  if (appState.mode === "favoritos") {
    appState.mode = getCurrentMode();
    favoritesToggle.setAttribute("aria-pressed", "false");
    updateFilterAvailability();
    updateSectionTitle();
    loadMovies();
    return;
  }

  cancelActiveRequest();
  appState.mode = "favoritos";
  appState.page = 1;
  appState.totalPages = 1;
  favoritesToggle.setAttribute("aria-pressed", "true");
  updateFilterAvailability();
  sectionTitle.textContent = "Mis películas favoritas";
  emptyMessage.textContent = "Guarda películas con el corazón y aparecerán aquí.";
  errorState.hidden = true;
  loadingState.hidden = true;
  movieGrid.hidden = false;
  loadMoreButton.hidden = true;
  loadMoreWrap.hidden = true;
  renderMovies(appState.favorites);
}

function toggleFavorite(movie) {
  const removedFavoriteIndex = appState.favorites.findIndex(
    favorite => String(favorite.id) === String(movie.id)
  );
  if (removedFavoriteIndex !== -1) {
    appState.favorites = appState.favorites.filter(
      favorite => String(favorite.id) !== String(movie.id)
    );
  } else {
    appState.favorites = [...appState.favorites, {
      id: movie.id,
      title: movie.title || "Título no disponible",
      poster_path: movie.poster_path || null,
      release_date: movie.release_date || "",
      vote_average: Number(movie.vote_average) || 0
    }];
  }

  const isSaved = saveFavorites();
  updateFavoritesCount();
  document.querySelectorAll(".favorite-button").forEach(button => {
    if (button.dataset.favoriteId === String(movie.id)) {
      updateFavoriteButton(button, movie);
    }
  });

  if (appState.mode === "favoritos") {
    renderMovies(appState.favorites);
    if (!isSaved) {
      resultsAnnouncement.textContent = "No se pudieron guardar los cambios de favoritos en este dispositivo.";
    }
    if (removedFavoriteIndex !== -1 && !movieDialog.contains(document.activeElement)) {
      const nextCard = movieGrid.children[Math.min(removedFavoriteIndex, movieGrid.children.length - 1)];
      (nextCard || favoritesToggle).focus();
    }
  } else if (isSaved) {
    resultsAnnouncement.textContent = `${movie.title} ${isFavorite(movie.id) ? "se agregó a" : "se quitó de"} favoritos.`;
  } else {
    resultsAnnouncement.textContent = "No se pudieron guardar los cambios de favoritos en este dispositivo.";
  }
}

function noteConnectionFailure(source, retryAction) {
  appState.hadConnectionError = true;
  appState.connectionRetryAction = retryAction;
  appState.connectionErrorSource = source;
}

function clearConnectionFailure(source) {
  if (appState.connectionErrorSource === source) {
    appState.hadConnectionError = false;
    appState.connectionRetryAction = null;
    appState.connectionErrorSource = null;
  }
}

// Capa de API
// Escenarios locales de demostración; no alteran las solicitudes normales.
function getSimulatedResponse(endpoint) {
  if (DEMO_MODE === "offline") {
    throw new AppError(ERROR_TYPES.SIN_CONEXION, "Error de conexión simulado.");
  }

  const statuses = { "401": 401, "429": 429, "500": 500 };
  if (statuses[DEMO_MODE]) {
    return {
      ok: false,
      status: statuses[DEMO_MODE],
      headers: { get: name => name.toLowerCase() === "retry-after" ? "0" : null }
    };
  }

  if (
    DEMO_MODE === "vacio"
    && ["/movie/popular", "/search/movie", "/discover/movie"].includes(endpoint)
  ) {
    return { ok: true, json: async () => ({ results: [], total_pages: 1 }) };
  }

  return null;
}

async function fetchTMDB(endpoint, params = {}, signal) {
  const url = new URL(`${CONFIG.BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", CONFIG.API_KEY);
  url.searchParams.set("language", CONFIG.LANGUAGE);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  for (let attempt = 0; attempt <= 2; attempt += 1) {
    const simulatedResponse = getSimulatedResponse(endpoint);
    const result = simulatedResponse
      ? await readTMDBResponse(endpoint, simulatedResponse)
      : await fetchWithTimeout(url, signal, response => readTMDBResponse(endpoint, response));

    if (result.response?.status === 429) {
      const error = createHttpError(result.response);
      if (attempt < 2) {
        const retryDelay = error.retryAfter === null
          ? 500 * (2 ** attempt)
          : error.retryAfter * 1000 * (2 ** attempt);
        await waitForRetry(retryDelay, signal);
        continue;
      }
      if (!error.retryAfter) {
        error.retryAfter = 4;
      }
      throw error;
    }

    return result.data;
  }
}

async function readTMDBResponse(endpoint, response) {
  if (response.status === 429) {
    return { response };
  }
  if (!response.ok) {
    throw createHttpError(response);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }
    if (error instanceof TypeError || error?.name === "TypeError") {
      throw error;
    }
    throw new AppError(ERROR_TYPES.RESPUESTA_INVALIDA, "La respuesta JSON no es válida.", { cause: error });
  }

  if (!isValidTMDBResponse(endpoint, data)) {
    throw new AppError(ERROR_TYPES.RESPUESTA_INVALIDA, "La estructura de respuesta no es válida.");
  }

  return { data };
}

function createHttpError(response) {
  const retryAfterHeader = response.headers.get("Retry-After");
  let retryAfterSeconds = null;
  if (retryAfterHeader) {
    const numericDelay = Number(retryAfterHeader);
    const dateDelay = (Date.parse(retryAfterHeader) - Date.now()) / 1000;
    const parsedDelay = Number.isFinite(numericDelay) ? numericDelay : dateDelay;
    if (Number.isFinite(parsedDelay)) {
      retryAfterSeconds = Math.max(0, parsedDelay);
    }
  }

  if (response.status === 401) {
    return new AppError(ERROR_TYPES.CLAVE_INVALIDA, "TMDB rechazó las credenciales.");
  }
  if (response.status === 404) {
    return new AppError(ERROR_TYPES.NO_ENCONTRADO, "El recurso solicitado no existe.");
  }
  if (response.status === 429) {
    return new AppError(ERROR_TYPES.LIMITE_PETICIONES, "Se alcanzó el límite de solicitudes.", {
      retryAfter: retryAfterSeconds
    });
  }
  if (response.status >= 500 && response.status <= 599) {
    return new AppError(ERROR_TYPES.ERROR_SERVIDOR, "TMDB no está disponible.");
  }

  return new AppError(ERROR_TYPES.RESPUESTA_INVALIDA, "TMDB rechazó la solicitud.");
}

async function fetchWithTimeout(url, signal, consumeResponse) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new AppError(ERROR_TYPES.SIN_CONEXION, "El navegador no tiene conexión.");
  }
  if (signal?.aborted) {
    throw new DOMException("La solicitud fue cancelada.", "AbortError");
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 10_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return await consumeResponse(response);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (timedOut) {
      throw new AppError(ERROR_TYPES.TIMEOUT, "La solicitud excedió el tiempo límite.", { cause: error });
    }
    if (signal?.aborted) {
      throw error;
    }
    if (error instanceof TypeError || error?.name === "TypeError") {
      throw new AppError(ERROR_TYPES.SIN_CONEXION, "No fue posible conectar con TMDB.", { cause: error });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

function waitForRetry(delay, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("La solicitud fue cancelada.", "AbortError"));
      return;
    }

    const timeoutId = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delay);
    const abort = () => {
      window.clearTimeout(timeoutId);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("La solicitud fue cancelada.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function isValidTMDBResponse(endpoint, data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  if (["/movie/popular", "/search/movie", "/discover/movie"].includes(endpoint)) {
    return Array.isArray(data.results)
      && Number.isInteger(data.total_pages)
      && data.total_pages >= 0;
  }
  if (endpoint === "/genre/movie/list") {
    return Array.isArray(data.genres)
      && data.genres.every(genre => Number.isInteger(genre.id) && typeof genre.name === "string");
  }
  if (/^\/movie\/\d+$/.test(endpoint)) {
    return Number.isInteger(data.id)
      && typeof data.title === "string"
      && data.credits
      && Array.isArray(data.credits.cast)
      && data.videos
      && Array.isArray(data.videos.results);
  }

  return true;
}

async function getPopularMovies(page, signal) {
  return fetchTMDB("/movie/popular", { page }, signal);
}

async function searchMovies(query, page, signal) {
  return fetchTMDB("/search/movie", { query, page }, signal);
}

async function discoverMovies(filters, page, signal) {
  const sortBy = {
    popular: "popularity.desc",
    rating: "vote_average.desc",
    recent: "primary_release_date.desc"
  }[filters.sort];
  const params = { page, sort_by: sortBy };

  if (filters.genre) {
    params.with_genres = filters.genre;
  }

  if (filters.sort === "rating") {
    params["vote_count.gte"] = 200;
  }

  return fetchTMDB("/discover/movie", params, signal);
}

async function getMovieGenres() {
  const data = await fetchTMDB("/genre/movie/list");
  return data.genres;
}

async function getMovieDetails(movieId, signal) {
  const movie = await fetchTMDB(
    `/movie/${movieId}`,
    { append_to_response: "credits,videos" },
    signal
  );

  if (movie.overview?.trim()) {
    return { movie, overviewIsEnglish: false };
  }

  const englishMovie = await fetchTMDB(
    `/movie/${movieId}`,
    { append_to_response: "credits,videos", language: "en-US" },
    signal
  );

  return {
    movie: { ...movie, overview: englishMovie.overview },
    overviewIsEnglish: Boolean(englishMovie.overview?.trim())
  };
}

// Renderizado
function createMovieCard(movie) {
  const title = movie.title || "Título no disponible";
  const year = movie.release_date?.slice(0, 4) || "Año desconocido";
  const ratingValue = Number(movie.vote_average) || 0;
  const card = document.createElement("article");
  card.className = "movie-card";
  card.tabIndex = 0;
  card.setAttribute("role", "listitem");
  card.setAttribute("aria-keyshortcuts", "Enter Space");
  card.setAttribute(
    "aria-label",
    `${title}, ${year}, calificación ${ratingValue.toFixed(1)} de 10. Presiona Enter para ver el detalle.`
  );
  card.dataset.movieId = movie.id;

  const poster = document.createElement("div");
  poster.className = "movie-poster";

  if (movie.poster_path) {
    const image = document.createElement("img");
    image.className = "movie-poster-image";
    image.src = `${CONFIG.IMG_URL}w342${movie.poster_path}`;
    image.alt = `Póster de ${title}`;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.remove();
      poster.append(createPosterPlaceholder());
    }, { once: true });
    poster.append(image);
  } else {
    poster.append(createPosterPlaceholder());
  }
  poster.append(createFavoriteButton(movie));

  const info = document.createElement("div");
  info.className = "movie-info";

  const heading = document.createElement("h3");
  heading.className = "movie-title";
  heading.textContent = title;

  const meta = document.createElement("div");
  meta.className = "movie-meta";

  const yearText = document.createElement("span");
  yearText.textContent = year;

  const rating = document.createElement("span");
  rating.className = `rating ${getRatingClass(ratingValue)}`;

  const star = document.createElement("span");
  star.setAttribute("aria-hidden", "true");
  star.textContent = "★";

  const ratingText = document.createElement("span");
  ratingText.textContent = ratingValue.toFixed(1);
  rating.setAttribute("aria-label", `Calificación: ${ratingValue.toFixed(1)} de 10`);
  rating.append(star, ratingText);

  meta.append(yearText, rating);
  info.append(heading, meta);
  card.append(poster, info);

  return card;
}

function createPosterPlaceholder() {
  const placeholder = document.createElement("span");
  placeholder.className = "poster-placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  return placeholder;
}

function getRatingClass(rating) {
  if (rating >= 7) {
    return "rating--high";
  }

  if (rating >= 5) {
    return "rating--medium";
  }

  return "rating--low";
}

function createTextElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function clearErrorCountdown(container) {
  const timerId = errorCountdowns.get(container);
  if (timerId) {
    window.clearInterval(timerId);
    errorCountdowns.delete(container);
  }
}

function renderErrorState(container, error, onRetry, isDialog = false) {
  clearErrorCountdown(container);
  const presentation = getErrorPresentation(error);
  const errorContent = document.createElement("div");
  errorContent.className = isDialog ? "detail-error" : "error-state-content";
  errorContent.setAttribute("role", "alert");

  const icon = createTextElement("span", "state-icon", presentation.icon);
  icon.setAttribute("aria-hidden", "true");
  const title = createTextElement(
    "h2",
    isDialog ? "detail-error-title" : "",
    presentation.title
  );
  if (isDialog) {
    title.id = "dialog-title";
  }
  const description = createTextElement(
    "p",
    isDialog ? "detail-error-message" : "",
    presentation.description
  );
  errorContent.append(icon, title, description);

  if (!presentation.allowsRetry || typeof onRetry !== "function") {
    container.replaceChildren(errorContent);
    return;
  }

  const retryButton = document.createElement("button");
  retryButton.className = "button button--primary";
  retryButton.type = "button";
  retryButton.textContent = "Reintentar";
  retryButton.addEventListener("click", onRetry);
  errorContent.append(retryButton);

  if (error.type !== ERROR_TYPES.LIMITE_PETICIONES) {
    container.replaceChildren(errorContent);
    return;
  }

  let remainingSeconds = Math.ceil(error.retryAfter ?? 0);
  if (remainingSeconds <= 0) {
    container.replaceChildren(errorContent);
    return;
  }

  retryButton.disabled = true;
  const countdown = createTextElement(
    "p",
    "error-countdown",
    `Podrás reintentar en ${remainingSeconds} s.`
  );
  errorContent.append(countdown);
  container.replaceChildren(errorContent);

  const timerId = window.setInterval(() => {
    remainingSeconds -= 1;
    if (remainingSeconds <= 0) {
      clearErrorCountdown(container);
      retryButton.disabled = false;
      countdown.textContent = "Ya puedes intentarlo de nuevo.";
      return;
    }
    countdown.textContent = `Podrás reintentar en ${remainingSeconds} s.`;
  }, 1000);
  errorCountdowns.set(container, timerId);
}

function showMovieDetailLoading() {
  const loading = document.createElement("div");
  loading.className = "detail-loading";
  loading.setAttribute("role", "status");
  const title = createTextElement("h2", "visually-hidden", "Cargando detalle de película");
  title.id = "dialog-title";
  loading.append(title);

  const backdrop = document.createElement("div");
  backdrop.className = "detail-skeleton detail-skeleton--backdrop";
  const heading = document.createElement("div");
  heading.className = "detail-skeleton detail-skeleton--heading";
  const line = document.createElement("div");
  line.className = "detail-skeleton detail-skeleton--line";
  const cast = document.createElement("div");
  cast.className = "detail-skeleton detail-skeleton--cast";
  loading.append(backdrop, heading, line, cast);
  dialogContent.replaceChildren(loading);
}

function createCastMember(actor) {
  const member = document.createElement("li");
  member.className = "cast-member";

  if (actor.profile_path) {
    const image = document.createElement("img");
    image.className = "cast-photo";
    image.src = `${CONFIG.IMG_URL}w185${actor.profile_path}`;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => {
      image.replaceWith(createCastInitial(actor.name));
    }, { once: true });
    member.append(image);
  } else {
    member.append(createCastInitial(actor.name));
  }

  const name = createTextElement("span", "cast-name", actor.name || "Nombre no disponible");
  const character = createTextElement(
    "span",
    "cast-character",
    actor.character || "Personaje no disponible"
  );
  member.append(name, character);

  return member;
}

function createCastInitial(name = "") {
  return createTextElement("span", "cast-initial", name.trim().charAt(0).toUpperCase() || "?");
}

function createGenreChips(genres = []) {
  const list = document.createElement("ul");
  list.className = "detail-genres";
  list.setAttribute("aria-label", "Géneros");

  genres.forEach(genre => {
    list.append(createTextElement("li", "genre-chip", genre.name));
  });

  return list;
}

function createMovieDetailContent({ movie, overviewIsEnglish }) {
  const content = document.createElement("div");
  content.className = "movie-detail";

  if (movie.backdrop_path) {
    const backdrop = document.createElement("img");
    backdrop.className = "detail-backdrop";
    backdrop.src = `${CONFIG.IMG_URL}original${movie.backdrop_path}`;
    backdrop.alt = "";
    backdrop.addEventListener("error", () => {
      backdrop.remove();
      content.classList.add("movie-detail--no-backdrop");
    }, { once: true });
    content.append(backdrop);
  }

  const body = document.createElement("div");
  body.className = "detail-body";

  const poster = document.createElement("div");
  poster.className = "detail-poster";
  if (movie.poster_path) {
    const posterImage = document.createElement("img");
    posterImage.src = `${CONFIG.IMG_URL}w342${movie.poster_path}`;
    posterImage.alt = `Póster de ${movie.title}`;
    posterImage.addEventListener("error", () => {
      posterImage.replaceWith(createPosterPlaceholder());
    }, { once: true });
    poster.append(posterImage);
  } else {
    poster.append(createPosterPlaceholder());
  }

  const information = document.createElement("div");
  information.className = "detail-information";
  const title = createTextElement("h2", "detail-title", movie.title);
  title.id = "dialog-title";
  information.append(title);

  if (movie.tagline) {
    information.append(createTextElement("p", "detail-tagline", `“${movie.tagline}”`));
  }

  const metadata = document.createElement("div");
  metadata.className = "detail-metadata";
  const year = movie.release_date?.slice(0, 4) || "Año no disponible";
  const runtime = movie.runtime
    ? `${Math.floor(movie.runtime / 60)} h ${movie.runtime % 60} min`
    : "Duración no disponible";
  const rating = Number(movie.vote_average) || 0;
  metadata.append(
    createTextElement("span", "detail-year", year),
    createTextElement("span", "detail-runtime", runtime),
    createTextElement("span", `detail-rating ${getRatingClass(rating)}`, `★ ${rating.toFixed(1)}`)
  );
  information.append(
    metadata,
    createGenreChips(movie.genres),
    createFavoriteButton(movie)
  );

  const overviewSection = document.createElement("section");
  overviewSection.className = "detail-overview";
  overviewSection.append(createTextElement("h3", "detail-section-title", "Sinopsis"));
  if (overviewIsEnglish) {
    overviewSection.append(
      createTextElement("p", "detail-language-note", "Sinopsis disponible en inglés.")
    );
  }
  overviewSection.append(
    createTextElement("p", "detail-overview-text", movie.overview || "Sinopsis no disponible.")
  );
  information.append(overviewSection);

  const cast = movie.credits?.cast?.slice(0, 8) || [];
  if (cast.length > 0) {
    const castSection = document.createElement("section");
    castSection.className = "detail-cast";
    castSection.append(createTextElement("h3", "detail-section-title", "Reparto principal"));
    const castList = document.createElement("ul");
    castList.className = "cast-list";
    cast.forEach(actor => castList.append(createCastMember(actor)));
    castSection.append(castList);
    information.append(castSection);
  }

  const trailer = movie.videos?.results?.find(video =>
    video.site === "YouTube" && video.type === "Trailer" && video.key
  );
  if (trailer) {
    const trailerLink = document.createElement("a");
    trailerLink.className = "button button--primary detail-trailer";
    trailerLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`;
    trailerLink.target = "_blank";
    trailerLink.rel = "noopener noreferrer";
    trailerLink.textContent = "Ver tráiler";
    information.append(trailerLink);
  }

  body.append(poster, information);
  content.append(body);
  return content;
}

function renderMovieDetails(detail) {
  dialogContent.replaceChildren(createMovieDetailContent(detail));
}

async function loadMovieDetail(movieId) {
  appState.detailRequestController?.abort();
  const controller = new AbortController();
  appState.detailRequestController = controller;
  appState.activeMovieId = movieId;
  showMovieDetailLoading();

  try {
    const detail = await getMovieDetails(movieId, controller.signal);
    if (appState.detailRequestController !== controller) {
      return;
    }
    clearConnectionFailure("detail");
    renderMovieDetails(detail);
  } catch (error) {
    if (controller.signal.aborted || error.name === "AbortError") {
      return;
    }
    console.error("Error al cargar el detalle de la película.", error);
    if (error.type === ERROR_TYPES.SIN_CONEXION) {
      noteConnectionFailure("detail", () => loadMovieDetail(movieId));
    }
    renderErrorState(dialogContent, error, () => loadMovieDetail(movieId), true);
  }
}

function openMovieDetail(movieId, opener) {
  if (!movieId || movieDialog.open) {
    return;
  }

  appState.detailOpener = opener;
  appState.previousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  movieDialog.showModal();
  loadMovieDetail(movieId);
}

function closeMovieDetail() {
  if (movieDialog.open) {
    movieDialog.close();
  }
}

function handleMovieGridClick(event) {
  if (event.target.closest(".favorite-button")) {
    return;
  }
  const card = event.target.closest(".movie-card");
  if (card && movieGrid.contains(card)) {
    openMovieDetail(card.dataset.movieId, card);
  }
}

function handleMovieGridKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }
  if (event.target.closest(".favorite-button")) {
    return;
  }

  const card = event.target.closest(".movie-card");
  if (!card || !movieGrid.contains(card)) {
    return;
  }

  event.preventDefault();
  openMovieDetail(card.dataset.movieId, card);
}

function renderMovies(movies) {
  movieGrid.replaceChildren(...movies.map(createMovieCard));
  emptyState.hidden = movies.length > 0;
  if (appState.mode === "favoritos") {
    emptyMessage.textContent = "Guarda películas con el corazón y aparecerán aquí.";
  }
  resultsAnnouncement.textContent = movies.length === 1
    ? "Se muestra 1 película."
    : `Se muestran ${movies.length} películas.`;
}

function setLoading(isLoading) {
  appState.isLoading = isLoading;
  loadingState.hidden = !isLoading;
  const hasError = !errorState.hidden && errorState.dataset.errorSource !== "genres";
  movieGrid.hidden = (isLoading && appState.movies.length === 0) || hasError;
  loadMoreButton.hidden = hasError
    || appState.movies.length === 0
    || appState.page >= appState.totalPages;
  loadMoreWrap.hidden = loadMoreButton.hidden;
  loadMoreButton.disabled = isLoading;
}

function getCurrentMode() {
  if (appState.filters.query.trim().length >= 2) {
    return "búsqueda";
  }

  if (appState.filters.genre || appState.filters.sort !== "popular") {
    return "discover";
  }

  return "popular";
}

function updateSectionTitle() {
  if (appState.mode === "búsqueda") {
    sectionTitle.textContent = `Resultados para «${appState.filters.query}»`;
  } else if (appState.mode === "discover" && appState.filters.genre) {
    sectionTitle.textContent = `Películas de ${genreFilter.selectedOptions[0].textContent}`;
  } else if (appState.mode === "discover" && appState.filters.sort === "rating") {
    sectionTitle.textContent = "Películas mejor calificadas";
  } else if (appState.mode === "discover" && appState.filters.sort === "recent") {
    sectionTitle.textContent = "Películas más recientes";
  } else {
    sectionTitle.textContent = "Películas populares";
  }
}

// Inicialización
function showError(error, onRetry) {
  errorState.hidden = false;
  errorState.dataset.errorSource = "movies";
  emptyState.hidden = true;
  movieGrid.hidden = true;
  loadMoreButton.hidden = true;
  renderErrorState(errorState, error, onRetry);
}

async function loadMovies({ reset = true } = {}) {
  if (!reset && (appState.isLoading || appState.page >= appState.totalPages)) {
    return;
  }

  appState.requestController?.abort();
  const requestController = new AbortController();
  const requestId = ++appState.requestId;
  appState.requestController = requestController;
  appState.mode = getCurrentMode();
  updateSectionTitle();
  emptyMessage.textContent = appState.mode === "búsqueda"
    ? "Prueba con otro título."
    : "Prueba con otra búsqueda o cambia los filtros.";

  const page = reset ? 1 : appState.page + 1;
  loadingState.hidden = false;
  errorState.hidden = true;
  emptyState.hidden = true;
  setLoading(true);

  try {
    const data = appState.mode === "búsqueda"
      ? await searchMovies(appState.filters.query.trim(), page, requestController.signal)
      : appState.mode === "discover"
        ? await discoverMovies(appState.filters, page, requestController.signal)
        : await getPopularMovies(page, requestController.signal);

    if (requestId !== appState.requestId) {
      return;
    }

    clearConnectionFailure("movies");
    if (reset && data.results.length === 0) {
      appState.page = page;
      appState.totalPages = Number(data.total_pages) || 1;
      appState.movies = [];
      throw new AppError(ERROR_TYPES.SIN_RESULTADOS, "La consulta no devolvió películas.");
    }

    appState.page = page;
    appState.totalPages = Number(data.total_pages) || 1;
    appState.movies = reset ? data.results : [...appState.movies, ...data.results];
    renderMovies(appState.movies);
  } catch (error) {
    if (requestId !== appState.requestId || error.name === "AbortError") {
      return;
    }

    console.error("Error al cargar películas.", error);
    if (error.type === ERROR_TYPES.SIN_CONEXION) {
      noteConnectionFailure("movies", () => loadMovies({ reset }));
    }
    showError(error, () => loadMovies({ reset }));
  } finally {
    if (requestId === appState.requestId) {
      appState.requestController = null;
      setLoading(false);
    }
  }
}

function cancelActiveRequest() {
  appState.requestId += 1;
  appState.requestController?.abort();
  appState.requestController = null;
  setLoading(false);
}

function scheduleSearch() {
  window.clearTimeout(appState.searchDebounce);
  const query = searchInput.value.trim();
  appState.filters.query = query;
  updateFilterAvailability();

  if (query.length < 2) {
    if (appState.mode !== "popular") {
      cancelActiveRequest();
      loadMovies();
    } else if (appState.movies.length === 0 && !appState.isLoading) {
      loadMovies();
    }
    return;
  }

  cancelActiveRequest();
  appState.searchDebounce = window.setTimeout(() => {
    loadMovies();
  }, 500);
}

function initializeApp() {
  if (typeof CONFIG === "undefined" || !CONFIG || CONFIG.API_KEY === "TU_API_KEY_AQUI") {
    showError(new AppError(ERROR_TYPES.CLAVE_INVALIDA, "La clave API no está configurada."));
    return;
  }

  loadGenres();
  loadMovies();
}

async function loadGenres() {
  try {
    const genres = await getMovieGenres();
    clearConnectionFailure("genres");
    if (errorState.dataset.errorSource === "genres") {
      errorState.hidden = true;
      delete errorState.dataset.errorSource;
    }
    const defaultOption = genreFilter.options[0];
    genreFilter.replaceChildren(defaultOption);

    genres.forEach(genre => {
      const option = document.createElement("option");
      option.value = genre.id;
      option.textContent = genre.name;
      genreFilter.append(option);
    });
  } catch (error) {
    console.error("No se pudieron cargar los géneros de TMDB.", error);
    if (error.type === ERROR_TYPES.SIN_CONEXION) {
      noteConnectionFailure("genres", () => loadGenres());
    }
    errorState.dataset.errorSource = "genres";
    errorState.hidden = false;
    renderErrorState(errorState, error, () => loadGenres());
  }
}

function updateFilterAvailability() {
  const hasSearchText = appState.filters.query.length > 0;
  const favoritesOnly = appState.mode === "favoritos";
  genreFilter.disabled = hasSearchText || favoritesOnly;
  sortFilter.disabled = hasSearchText || favoritesOnly;
  searchInput.disabled = favoritesOnly;
  searchForm.querySelectorAll("button").forEach(button => {
    button.disabled = favoritesOnly;
  });
  filterControls.classList.toggle("is-disabled", hasSearchText || favoritesOnly);
}

function handleFilterChange() {
  if (appState.filters.query.length > 0) {
    return;
  }

  appState.filters.genre = genreFilter.value;
  appState.filters.sort = sortFilter.value;
  loadMovies();
}

searchInput.addEventListener("input", scheduleSearch);
searchForm.addEventListener("submit", event => {
  event.preventDefault();
  window.clearTimeout(appState.searchDebounce);
  cancelActiveRequest();
  appState.filters.query = searchInput.value.trim();
  updateFilterAvailability();
  loadMovies();
});
searchForm.addEventListener("reset", event => {
  event.preventDefault();
  window.clearTimeout(appState.searchDebounce);
  searchInput.value = "";
  appState.filters.query = "";
  appState.filters.genre = "";
  appState.filters.sort = "popular";
  genreFilter.value = "";
  sortFilter.value = "popular";
  updateFilterAvailability();
  cancelActiveRequest();
  loadMovies();
});
genreFilter.addEventListener("change", handleFilterChange);
sortFilter.addEventListener("change", handleFilterChange);
loadMoreButton.addEventListener("click", () => {
  loadMovies({ reset: false });
});
favoritesToggle.addEventListener("click", toggleFavoritesView);
updateFavoritesCount();
movieGrid.addEventListener("click", handleMovieGridClick);
movieGrid.addEventListener("keydown", handleMovieGridKeydown);
dialogCloseButton.addEventListener("click", closeMovieDetail);
movieDialog.addEventListener("click", event => {
  if (event.target === movieDialog) {
    closeMovieDetail();
  }
});
movieDialog.addEventListener("close", () => {
  appState.detailRequestController?.abort();
  appState.detailRequestController = null;
  appState.activeMovieId = null;
  document.body.style.overflow = appState.previousBodyOverflow;
  if (appState.detailOpener?.isConnected) {
    appState.detailOpener.focus();
  } else {
    favoritesToggle.focus();
  }
  appState.detailOpener = null;
});
window.addEventListener("offline", () => {
  connectionNotice.hidden = false;
});
window.addEventListener("online", () => {
  connectionNotice.hidden = true;
  if (appState.hadConnectionError && appState.connectionRetryAction) {
    const retryAction = appState.connectionRetryAction;
    appState.hadConnectionError = false;
    appState.connectionRetryAction = null;
    appState.connectionErrorSource = null;
    retryAction();
  }
});
connectionNotice.hidden = typeof navigator === "undefined" || navigator.onLine !== false;
backToTopButton.addEventListener("click", () => {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  window.scrollTo({ top: 0, behavior });
});
window.addEventListener("scroll", () => {
  backToTopButton.hidden = window.scrollY < 500;
}, { passive: true });
initializeApp();
