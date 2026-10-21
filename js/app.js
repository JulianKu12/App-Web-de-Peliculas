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
  movieGrid.hidden = isLoading;
  loadMoreButton.hidden = isLoading;
}

// Inicialización
