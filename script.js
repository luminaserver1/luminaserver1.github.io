const API_TOKEN = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJkMmIwMzY4NTAyYzEwY2YyMDQ4OThiYjg3MTgyYzAxMCIsIm5iZiI6MTc0NDkyNzMyMC4yMzEsInN1YiI6IjY4MDE3YTU4MmU4OTU4ZjBmOTk5NWQ0MSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.I22MMgWKL1X-2czV96nC49I4L3Fj_iKJm8qO_hm2GKk";
const BASE_URL = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

let currentCategory = 'action';
let trendingItems = [];

async function fetchTrending(type) {
    try {
        const response = await fetch(`${BASE_URL}/trending/${type}/day`, {
            headers: { Authorization: API_TOKEN }
        });
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error("Error fetching trending:", error);
        return [];
    }
}

async function displayTrending() {
    const type = document.getElementById("typeFilter").value;
    const items = await fetchTrending(type);
    const container = document.getElementById("trendingSlider");

    container.innerHTML = items.slice(0, 10).map(item => `
        <div class="movie-card">
            <img src="${IMG_BASE}${item.poster_path}" alt="${item.title || item.name}" class="movie-poster">
            <div class="movie-info">
                <h3 class="movie-title">${item.title || item.name}</h3>
                <p class="movie-year">${(item.release_date || item.first_air_date || "").slice(0, 4)}</p>
                <button onclick="watch('${item.id}', '${type}')" class="watch-btn">Watch Now</button>
            </div>
        </div>
    `).join('');
}

async function fetchMovies(type, count = 50, year = "", genre = "", searchTerm = "") {
    let movies = [];
    let page = 1;

    while (movies.length < count && page <= 10) {
        let url = "";

        if (searchTerm) {
            url = `${BASE_URL}/search/${type}?query=${encodeURIComponent(searchTerm)}&page=${page}`;
        } else {
            url = `${BASE_URL}/discover/${type}?sort_by=popularity.desc&page=${page}`;
            if (year) url += `&year=${year}`;
            if (genre) url += `&with_genres=${getGenreId(genre, type)}`;
        }

        try {
            const res = await fetch(url, {
                headers: { Authorization: API_TOKEN }
            });
            const data = await res.json();
            if (!data.results || data.results.length === 0) break;
            movies.push(...data.results.slice(0, count - movies.length));
            page++;
        } catch (error) {
            console.error("Error fetching movies:", error);
            break;
        }
    }

    return movies;
}

async function fetchCategoryData(category) {
    showLoading();
    currentCategory = category;
    updateActiveCategory(category);
    const type = document.getElementById("typeFilter").value;

    try {
        const items = await fetchMovies(type, 50, "", category);
        displayMovies(items, type);
        await displayTrending();
    } catch (err) {
        console.error("Category error:", err);
        document.getElementById('movies').innerHTML = "<p>Could not load content.</p>";
    }

    hideLoading();
}

async function fetchData() {
    showLoading();

    const type = document.getElementById("typeFilter").value;
    const year = document.getElementById("yearFilter").value;
    const genre = document.getElementById("genreFilter").value;

    try {
        const movies = await fetchMovies(type, 50, year, genre);
        displayMovies(movies, type);
        await displayTrending();
    } catch (err) {
        console.error("Fetch error:", err);
        document.getElementById('movies').innerHTML = "<p>Could not load content.</p>";
    }

    hideLoading();
}

async function searchMovies() {
    showLoading();

    const term = document.getElementById("searchInput").value.trim();
    if (!term) {
        fetchCategoryData(currentCategory);
        return;
    }

    try {
        // Search both movies and TV shows
        const movieResults = await fetchMovies("movie", 25, "", "", term);
        const tvResults = await fetchMovies("tv", 25, "", "", term);

        // Combine and sort results by popularity
        const combinedResults = [...movieResults, ...tvResults]
            .sort((a, b) => b.popularity - a.popularity);

        displayMovies(combinedResults, "all");
    } catch (err) {
        console.error("Search error:", err);
        document.getElementById('movies').innerHTML = "<p>Search failed.</p>";
    }

    hideLoading();
}

function updateActiveCategory(category) {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove("active");
        if (btn.textContent.toLowerCase() === category.toLowerCase()) {
            btn.classList.add("active");
        }
    });
}

async function displayMovies(items, type) {
    const container = document.getElementById("movies");
    container.innerHTML = "";

    if (!items.length) {
        container.innerHTML = "<p>No content found.</p>";
        return;
    }

    for (const item of items) {
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || "").slice(0, 4);
        const poster = item.poster_path ? IMG_BASE + item.poster_path : 'https://via.placeholder.com/300x450?text=No+Poster';

        const imdbID = await getIMDbID(item.id, type);

        const card = document.createElement("div");
        card.className = "movie-card";
        card.innerHTML = `
            <img src="${poster}" alt="${title}" class="movie-poster">
            <div class="movie-info">
                <h3 class="movie-title">${title}</h3>
                <p class="movie-year">${year}</p>
            </div>
            <button onclick="watch('${item.id}', '${type === 'all' ? (item.title ? 'movie' : 'tv') : type}')" class="watch-btn">Watch Now</button>
        `;
        container.appendChild(card);
    }
}

async function watch(id, type, season = 1, episode = 1) {
    try {
        const imdbID = await getIMDbID(id, type);
        if (type === "tv") {
            window.location.href = `stream.html?imdb=${imdbID}&type=${type}&season=${season}&episode=${episode}`;
        } else {
            window.location.href = `watch.html?id=${imdbID}`;
        }
    } catch (err) {
        console.error("Error getting IMDB ID:", err);
        // Fallback to TMDB ID if IMDB ID fails
        window.location.href = type === "tv" ? 
            `stream.html?imdb=${id}&type=${type}&season=${season}&episode=${episode}` : 
            `watch.html?id=${id}`;
    }
}

async function getIMDbID(tmdbID, type = "movie") {
    const url = `${BASE_URL}/${type}/${tmdbID}/external_ids`;
    try {
        const res = await fetch(url, {
            headers: { Authorization: API_TOKEN }
        });
        const data = await res.json();
        return data.imdb_id || tmdbID;
    } catch (err) {
        console.error("IMDb ID error:", err);
        return tmdbID;
    }
}

const GENRES = {
    movie: {
        action: 28, comedy: 35, horror: 27, drama: 18, romance: 10749, "sci-fi": 878, thriller: 53
    },
    tv: {
        action: 10759, comedy: 35, horror: 9648, drama: 18, romance: 10766, "sci-fi": 10765, thriller: 80
    }
};

function getGenreId(name, type = "movie") {
    return GENRES[type]?.[name.toLowerCase()] || "";
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('movies').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('movies').style.display = 'grid';
}

function displayResumeSection() {
    const resumeItems = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('watchProgress_')) {
            const imdbId = key.replace('watchProgress_', '');
            const data = JSON.parse(localStorage.getItem(key));
            if (data.currentTime > 0 && data.duration > 0) {
                resumeItems.push({ 
                    imdbId, 
                    type: data.type || 'movie',
                    title: data.title,
                    poster: data.poster,
                    season: data.season,
                    episodeId: data.episode,
                    progress: (data.currentTime / data.duration) * 100
                });
            }
        }
    }

    if (resumeItems.length > 0) {
        const container = document.createElement('div');
        container.className = 'resume-section';
        container.innerHTML = '<h2>Continue Watching</h2><div class="resume-items"></div>';

        const moviesGrid = document.getElementById('movies');
        moviesGrid.parentNode.insertBefore(container, moviesGrid);

        const itemsContainer = container.querySelector('.resume-items');

        resumeItems.forEach(async item => {
            const url = `${BASE_URL}/find/${item.imdbId}?external_source=imdb_id`;
            try {
                const res = await fetch(url, { headers: { Authorization: API_TOKEN } });
                const data = await res.json();
                const show = data.tv_results[0] || data.movie_results[0];

                if (show) {
                    const poster = show.poster_path ? IMG_BASE + show.poster_path : 'https://via.placeholder.com/300x450?text=No+Poster';
                    const title = show.title || show.name;
                    const type = show.title ? 'movie' : 'tv';

                    const resumeCard = document.createElement('div');
                    resumeCard.className = 'movie-card resume-card';
                    const progress = JSON.parse(localStorage.getItem(`watchProgress_${item.imdbId}`));
                    const progressPercent = progress ? (progress.currentTime / progress.duration) * 100 : 0;

                    resumeCard.innerHTML = `
                        <img src="${poster}" alt="${title}" class="movie-poster">
                        <div class="movie-info">
                            <h3 class="movie-title">${title}</h3>
                            ${type === 'tv' ? `<p class="episode-info">S${item.season} E${item.episodeId}</p>` : ''}
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${progressPercent}%"></div>
                            </div>
                            <button onclick="window.location.href = '${type === 'tv' ? 'media' : 'watch'}.html?id=${item.imdbId}${type === 'tv' ? `&season=${item.season}&episode=${item.episodeId}` : ''}&type=${type}'" class="watch-btn">Resume</button>
                        </div>
                    `;
                    itemsContainer.appendChild(resumeCard);
                }
            } catch (error) {
                console.error("Error fetching resume item:", error);
            }
        });
    }
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
    displayResumeSection();
    fetchCategoryData("action");

    // Add search on Enter key
    document.getElementById("searchInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") searchMovies();
    });

    // Add type filter change handler
    document.getElementById("typeFilter").addEventListener("change", () => {
        fetchCategoryData(currentCategory);
    });
});
