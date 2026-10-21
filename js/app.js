// Constantes y referencias al DOM
const movieGrid = document.querySelector(".movie-grid");
const loadingState = document.querySelector(".state--loading");
const errorState = document.querySelector(".state--error");
const emptyState = document.querySelector(".state--empty");
const loadMoreButton = document.querySelector(".load-more");

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
  isLoading: false
};

// Capa de API
async function fetchTMDB(endpoint, params = {}) {
  const url = new URL(`${CONFIG.BASE_URL}${endpoint}`);
  url.searchParams.set("api_key", CONFIG.API_KEY);
  url.searchParams.set("language", CONFIG.LANGUAGE);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`La API de TMDB respondió con el estado ${response.status}.`);
  }

  return response.json();
}

async function getPopularMovies(page) {
  const data = await fetchTMDB("/movie/popular", { page });
  return data.results;
}

// Renderizado

// Inicialización
