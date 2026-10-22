// Constantes y referencias al DOM
const movieGrid = document.querySelector(".movie-grid");
const loadingState = document.querySelector(".state--loading");
const errorState = document.querySelector(".state--error");
const emptyState = document.querySelector(".state--empty");
const errorTitle = errorState.querySelector("h2");
const errorMessage = errorState.querySelector("p");
const emptyMessage = emptyState.querySelector("p");
const sectionTitle = document.querySelector("#section-title");
const loadMoreButton = document.querySelector(".load-more");
const searchForm = document.querySelector(".search-form");
const searchInput = document.querySelector("#movie-search");
const genreFilter = document.querySelector("#genre-filter");

// Estado de la aplicación
const appState = {
  mode: "popular",
  page: 1,
  filters: {
    query: "",
    genre: "",
    sort: "popular"
  },
  movies: [],
  isLoading: false,
  requestId: 0,
  requestController: null,
  searchDebounce: null
};

// Capa de API
async function fetchTMDB(endpoint, params = {}, signal) {
  const url = new URL(`${CONFIG.BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", CONFIG.API_KEY);
  url.searchParams.set("language", CONFIG.LANGUAGE);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, { signal });

  if (!response.ok) {
    throw new Error(`La API de TMDB respondió con el estado ${response.status}.`);
  }

  return response.json();
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

// Renderizado
function createMovieCard(movie) {
  const title = movie.title || "Título no disponible";
  const card = document.createElement("article");
  card.className = "movie-card";
  card.tabIndex = 0;

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

  const info = document.createElement("div");
  info.className = "movie-info";

  const heading = document.createElement("h3");
  heading.className = "movie-title";
  heading.textContent = title;

  const meta = document.createElement("div");
  meta.className = "movie-meta";

  const year = document.createElement("span");
  year.textContent = movie.release_date?.slice(0, 4) || "Año desconocido";

  const rating = document.createElement("span");
  const ratingValue = Number(movie.vote_average) || 0;
  rating.className = `rating ${getRatingClass(ratingValue)}`;

  const star = document.createElement("span");
  star.setAttribute("aria-hidden", "true");
  star.textContent = "★";

  const ratingText = document.createElement("span");
  ratingText.textContent = ratingValue.toFixed(1);
  rating.setAttribute("aria-label", `Calificación: ${ratingValue.toFixed(1)} de 10`);
  rating.append(star, ratingText);

  meta.append(year, rating);
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

function renderMovies(movies) {
  movieGrid.replaceChildren(...movies.map(createMovieCard));
  emptyState.hidden = movies.length > 0;
}

function setLoading(isLoading) {
  appState.isLoading = isLoading;
  loadingState.hidden = !isLoading;
  const hasError = !errorState.hidden;
  movieGrid.hidden = isLoading || hasError;
  loadMoreButton.hidden = isLoading || hasError || appState.movies.length === 0;
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
function showError(title, message) {
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  errorState.hidden = false;
  emptyState.hidden = true;
  movieGrid.hidden = true;
  loadMoreButton.hidden = true;
}

async function loadMovies({ reset = true } = {}) {
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

    appState.page = page;
    appState.movies = reset ? data.results : [...appState.movies, ...data.results];
    renderMovies(appState.movies);
  } catch (error) {
    if (requestId !== appState.requestId || error.name === "AbortError") {
      return;
    }

    showError(
      "No se pudieron cargar las películas",
      `Ocurrió un error al conectar con TMDB: ${
        error instanceof Error ? error.message : "error desconocido"
      }`
    );
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
    showError(
      "Falta configurar la API de TMDB",
      "Agrega tu clave en js/config.js y vuelve a cargar la página."
    );
    return;
  }

  loadGenres();
  loadMovies();
}

async function loadGenres() {
  try {
    const genres = await getMovieGenres();
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
    const errorOption = document.createElement("option");
    errorOption.disabled = true;
    errorOption.textContent = "No se pudieron cargar los géneros";
    genreFilter.append(errorOption);
  }
}

searchInput.addEventListener("input", scheduleSearch);
searchForm.addEventListener("submit", event => {
  event.preventDefault();
  window.clearTimeout(appState.searchDebounce);
  cancelActiveRequest();
  appState.filters.query = searchInput.value.trim();
  loadMovies();
});
searchForm.addEventListener("reset", event => {
  event.preventDefault();
  window.clearTimeout(appState.searchDebounce);
  searchInput.value = "";
  appState.filters.query = "";
  cancelActiveRequest();
  loadMovies();
});
loadMoreButton.addEventListener("click", () => {
  loadMovies({ reset: false });
});
initializeApp();
