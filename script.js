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

    container.innerHTML = '';

    for (const item of items.slice(0, 10)) {
        const title = item.title || item.name;
        const year = (item.release_date || item.first_air_date || "").slice(0, 4);
        const poster = item.poster_path ? IMG_BASE + item.poster_path : 'https://via.placeholder.com/300x450?text=No+Poster';
        const itemType = type === 'all' ? (item.title ? 'movie' : 'tv') : type;
        const displayType = itemType === 'tv' ? 'TV Show' : 'Movie';

        const bookmarked = await isBookmarked(item.id, itemType);

        const cardElement = document.createElement('div');
        cardElement.className = 'movie-card';

        cardElement.innerHTML = `
            <div class="movie-poster-container">
                <img src="${poster}" alt="${title}" class="movie-poster">
                <button class="bookmark-btn ${bookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${item.id}', '${itemType}', '${title.replace(/'/g, "\\'")}', '${poster}', event)">
                    <svg viewBox="0 0 24 24" fill="${bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${title}</h3>
                <p class="movie-year">${year} • ${displayType}</p>
                <button onclick="watch('${item.id}', '${itemType}')" class="watch-btn">Watch Now</button>
            </div>
        `;

        cardElement.addEventListener('click', () => {
            localStorage.setItem(`lastClicked_${item.id}`, Date.now());
            if (itemType === 'tv') {
                window.location.href = `media.html?id=${item.id}&season=1&episode=1`;
            } else {
                window.location.href = `watch.html?id=${item.id}`;
            }
        });

        container.appendChild(cardElement);
    }
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
        document.getElementById('movies').innerHTML = "<p>Could not load content. This may be network related issues.</p>";
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
    const term = document.getElementById("searchInput").value.trim();
    if (!term) {
        return;
    }

    // Auto-navigate to explore section
    showSection('explore');
    showLoading();

    try {
        // Search both movies and TV shows
        const movieResults = await fetchMovies("movie", 25, "", "", term);
        const tvResults = await fetchMovies("tv", 25, "", "", term);

        // Combine and sort results by popularity
        const combinedResults = [...movieResults, ...tvResults]
            .sort((a, b) => b.popularity - a.popularity);

        displayMovies(combinedResults, "all");

        // Auto-scroll to results section
        setTimeout(() => {
            const resultsSection = document.getElementById('movies');
            if (resultsSection) {
                resultsSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
        }, 300);
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
        const itemType = type === 'all' ? (item.title ? 'movie' : 'tv') : type;

        const imdbID = await getIMDbID(item.id, type);
        const bookmarked = await isBookmarked(item.id, itemType);

        const card = document.createElement("div");
        card.className = "movie-card";
        card.style.position = "relative";

        const displayType = itemType === 'tv' ? 'TV Show' : 'Movie';

        card.innerHTML = `
            <div class="movie-poster-container">
                <img src="${poster}" alt="${title}" class="movie-poster">
                <button class="bookmark-btn ${bookmarked ? 'bookmarked' : ''}" onclick="toggleBookmark('${item.id}', '${itemType}', '${title.replace(/'/g, "\\'")}', '${poster}', event)">
                    <svg viewBox="0 0 24 24" fill="${bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>
            </div>
            <div class="movie-info">
                <h3 class="movie-title">${title}</h3>
                <p class="movie-year">${year} • ${displayType}</p>
                <button onclick="watch('${item.id}', '${itemType}')" class="watch-btn">Watch Now</button>
            </div>
        `;
        container.appendChild(card);
    }
}

function displayWatchLaterSection() {
    // Remove existing watch later section
    const existingSection = document.querySelector('.watch-later-section');
    if (existingSection) {
        existingSection.remove();
    }

    const watchLater = JSON.parse(localStorage.getItem('watchLater')) || [];

    if (watchLater.length > 0) {
        const container = document.createElement('div');
        container.className = 'watch-later-section';
        container.innerHTML = '<h2>Watch Later</h2><div class="watch-later-items"></div>';

        const announcementSection = document.getElementById('announcementSection');
        announcementSection.parentNode.insertBefore(container, announcementSection.nextSibling);

        const itemsContainer = container.querySelector('.watch-later-items');
        itemsContainer.className = 'resume-items'; // Reuse resume items styling

        // Sort by most recent first
        watchLater.sort((a, b) => b.timestamp - a.timestamp);

        watchLater.forEach(item => {
            const watchLaterCard = document.createElement('div');
            watchLaterCard.className = 'resume-card';

            watchLaterCard.innerHTML = `
                <div class="poster-container">
                    <img src="${item.poster}" alt="${item.title}" class="movie-poster">
                    <div class="play-overlay">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                            <path d="M6 4v16l12-8z"/>
                        </svg>
                    </div>
                </div>
                <button onclick="event.stopPropagation(); removeFromWatchLater('${item.id}', '${item.type}')" class="bookmark-btn bookmarked" style="top: 8px; right: 8px;">
                    <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                </button>
                <div class="movie-info">
                    <h3 class="movie-title">${item.title}</h3>
                    <div class="episode-info">
                        <span class="episode-season">${item.type === 'tv' ? 'TV Show' : 'Movie'}</span>
                        <span class="time-remaining">Saved</span>
                    </div>
                </div>
            `;

            // Add click event listener
            watchLaterCard.addEventListener('click', () => {
                // Update click timestamp for recent tracking
                localStorage.setItem(`lastClicked_${item.id}`, Date.now());

                if (item.type === 'tv') {
                    // Check for last watched episode or use defaults
                    const lastWatched = JSON.parse(localStorage.getItem(`lastWatched-${item.id}`));
                    const season = lastWatched?.season || 1;
                    const episode = lastWatched?.episodeId || 1;
                    window.location.href = `media.html?id=${item.id}&season=${season}&episode=${episode}`;
                } else {
                    window.location.href = `watch.html?id=${item.id}`;
                }
            });
            itemsContainer.appendChild(watchLaterCard);
        });
    }

    checkEmptyState();
}

function removeFromWatchLater(id, type) {
    const watchLater = JSON.parse(localStorage.getItem('watchLater')) || [];
    const filtered = watchLater.filter(item => !(item.id === id && item.type === type));
    localStorage.setItem('watchLater', JSON.stringify(filtered));
    displayWatchLaterSection();
}

function checkEmptyState() {
    const resumeSection = document.querySelector('.resume-section');
    const watchLaterSection = document.querySelector('.watch-later-section');
    const emptyState = document.getElementById('homeEmptyState');

    if (!resumeSection && !watchLaterSection) {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
    }
}

function openStreamSettings(imdbId) {
    window.location.href = `media.html?imdb=${imdbId}&type=tv`;
}

async function watch(id, type, season = 1, episode = 1) {
    try {
        const imdbID = await getIMDbID(id, type);
        localStorage.setItem(`lastClicked_${imdbID}`, Date.now());

        if (type === "tv") {
            // Get last watched episode or use defaults
            const lastWatched = JSON.parse(localStorage.getItem(`lastWatched-${imdbID}`));
            const watchedSeason = lastWatched?.season || season;
            const watchedEpisode = lastWatched?.episodeId || episode;

            // Save minimal progress data
            const existingProgress = JSON.parse(localStorage.getItem(`watchProgress_${imdbID}`)) || {};
            const progressData = {
                currentTime: existingProgress.currentTime || 0,
                duration: existingProgress.duration || 2700,
                title: await getMediaTitle(imdbID, type),
                poster: await getMediaPoster(imdbID, type),
                type: type,
                season: watchedSeason,
                episode: watchedEpisode,
                lastUpdated: Date.now()
            };
            localStorage.setItem(`watchProgress_${imdbID}`, JSON.stringify(progressData));

            window.location.href = `media.html?id=${imdbID}&season=${watchedSeason}&episode=${watchedEpisode}`;
        } else {
            const existingProgress = JSON.parse(localStorage.getItem(`watchProgress_${imdbID}`)) || {};
            const progressData = {
                currentTime: existingProgress.currentTime || 0,
                duration: existingProgress.duration || 6300,
                title: await getMediaTitle(imdbID, type),
                poster: await getMediaPoster(imdbID, type),
                type: type,
                lastUpdated: Date.now()
            };
            localStorage.setItem(`watchProgress_${imdbID}`, JSON.stringify(progressData));

            window.location.href = `watch.html?id=${imdbID}`;
        }
    } catch (err) {
        console.error("Error getting IMDB ID:", err);
        localStorage.setItem(`lastClicked_${id}`, Date.now());

        if (type === "tv") {
            const lastWatched = JSON.parse(localStorage.getItem(`lastWatched-${id}`));
            const watchedSeason = lastWatched?.season || season;
            const watchedEpisode = lastWatched?.episodeId || episode;
            window.location.href = `media.html?id=${id}&season=${watchedSeason}&episode=${watchedEpisode}`;
        } else {
            window.location.href = `watch.html?id=${id}`;
        }
    }
}

// Bookmark functionality
async function toggleBookmark(id, type, title, poster, event) {
    event.stopPropagation();
    event.preventDefault();

    const bookmarks = JSON.parse(localStorage.getItem('watchLater')) || [];
    const existingIndex = bookmarks.findIndex(item => item.id === id && item.type === type);

    if (existingIndex > -1) {
        // Remove from bookmarks
        bookmarks.splice(existingIndex, 1);
        event.target.closest('.bookmark-btn').classList.remove('bookmarked');
    } else {
        // Get the correct ID format for launching
        let launchId = id;
        try {
            // If this is a TMDB ID, convert to IMDB ID for proper launching
            if (type === 'movie' || type === 'tv') {
                const imdbID = await getIMDbID(id, type);
                launchId = imdbID || id;
            }
        } catch (error) {
            console.error("Error getting IMDB ID for bookmark:", error);
            // Use original ID as fallback
        }

        // Add to bookmarks with launch-ready ID
        bookmarks.push({
            id: launchId,
            type: type,
            title: title,
            poster: poster,
            timestamp: Date.now()
        });
        event.target.closest('.bookmark-btn').classList.add('bookmarked');
    }

    localStorage.setItem('watchLater', JSON.stringify(bookmarks));

    // Refresh watch later section if on home page
    if (document.getElementById('homeSection').style.display !== 'none') {
        displayWatchLaterSection();
    }
}

async function isBookmarked(id, type) {
    const bookmarks = JSON.parse(localStorage.getItem('watchLater')) || [];

    // Check with original ID first
    if (bookmarks.some(item => item.id === id && item.type === type)) {
        return true;
    }

    // Also check with IMDB ID conversion for TMDB IDs
    try {
        if (type === 'movie' || type === 'tv') {
            const imdbID = await getIMDbID(id, type);
            if (imdbID && imdbID !== id) {
                return bookmarks.some(item => item.id === imdbID && item.type === type);
            }
        }
    } catch (error) {
        // Ignore conversion errors, return false
    }

    return false;
}

// Search functionality
function toggleSearch() {
    const searchContainer = document.getElementById('searchContainer');
    const searchOverlay = document.getElementById('searchOverlay');

    searchContainer.classList.add('active');
    searchContainer.classList.remove('collapsed');
    searchOverlay.classList.add('active');

    // Focus on input
    setTimeout(() => {
        document.getElementById('searchInput').focus();
    }, 100);
}

function closeSearch() {
    const searchContainer = document.getElementById('searchContainer');
    const searchOverlay = document.getElementById('searchOverlay');

    searchContainer.classList.remove('active');
    searchContainer.classList.add('collapsed');
    searchOverlay.classList.remove('active');

    // Clear search if no results
    document.getElementById('searchInput').value = '';
}

// Section management
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('hidden');
    });

    // Show selected section
    const targetSection = document.getElementById(sectionName + 'Section');
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.section === sectionName) {
            item.classList.add('active');
        }
    });

    // Load content based on section
    if (sectionName === 'explore') {
        // Load explore content if not already loaded
        fetchCategoryData(currentCategory);
    } else if (sectionName === 'home') {
        // Refresh home content
        displayResumeSection();
        displayWatchLaterSection();
        checkEmptyState();
    } else if (sectionName === 'settings') {
        // Sync mobile settings with desktop settings
        loadEnhancedMobileSettings();
    }
}

function loadEnhancedMobileSettings() {
            // Load all mobile setting states
            const toggles = {
                'mobileTransparentToggle': localStorage.getItem('transparentMode') === 'true',
                'mobileAutoplayToggle': localStorage.getItem('autoplayEnabled') !== 'false',
                'mobileSaveProgressToggle': localStorage.getItem('saveProgressEnabled') !== 'false',
                'mobileDeveloperModeToggle': localStorage.getItem('developerMode') === 'true',
                'mobilePreloadToggle': localStorage.getItem('preloadNextEpisode') === 'true',
                'mobileHideAnnouncementToggle': localStorage.getItem('hideAnnouncement') === 'true',
                'mobileHideTrendingToggle': localStorage.getItem('hideTrending') === 'true',
                'mobileHideGenresToggle': localStorage.getItem('hideGenres') === 'true',
                'mobileHideMoviesToggle': localStorage.getItem('hideMovies') === 'true'
            };

            Object.entries(toggles).forEach(([id, isActive]) => {
                const element = document.getElementById(id);
                if (element) {
                    if (isActive) {
                        element.classList.add('active');
                    } else {
                        element.classList.remove('active');
                    }
                }
            });

            // Load accent color
            const savedColor = localStorage.getItem('accentColor') || 'purple';
            const colorCards = document.querySelectorAll('.color-card');
            colorCards.forEach(card => {
                card.classList.remove('active');
                if (card.dataset.color === savedColor) {
                    card.classList.add('active');
                }
            });
        }

async function getMediaTitle(imdbID, type) {
    try {
        const response = await fetch(`https://www.omdbapi.com/?i=${imdbID}&apikey=756f44a5`);
        const data = await response.json();
        return data.Title || 'Unknown Title';
    } catch {
        return 'Unknown Title';
    }
}

async function getMediaPoster(imdbID, type) {
    try {
        const response = await fetch(`https://www.omdbapi.com/?i=${imdbID}&apikey=756f44a5`);
        const data = await response.json();
        return data.Poster || 'https://via.placeholder.com/300x450?text=No+Poster';
    } catch {
        return 'https://via.placeholder.com/300x450?text=No+Poster';
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
        action: 28, comedy: 35, horror: 27, drama: 18, romance: 10749, "sci-fi": 878, thriller: 53, animation: 16, documentary: 99
    },
    tv: {
        action: 10759, comedy: 35, horror: 9648, drama: 18, romance: 10766, "sci-fi": 10765, thriller: 80, animation: 16, documentary: 99
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
    // Remove existing resume section to prevent duplicates
    const existingSection = document.querySelector('.resume-section');
    if (existingSection) {
        existingSection.remove();
    }

    const resumeItems = [];
    const seenIds = new Set(); // Track seen IDs to prevent duplicates

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('watchProgress_')) {
            const imdbId = key.replace('watchProgress_', '');

            // Skip if we've already seen this ID
            if (seenIds.has(imdbId)) {
                continue;
            }
            seenIds.add(imdbId);

            const data = JSON.parse(localStorage.getItem(key));
            if (data.currentTime > 0 && data.duration > 0) {
                const lastClicked = localStorage.getItem(`lastClicked_${imdbId}`);
                const lastUpdated = data.lastUpdated || 0;

                // Parse timestamps and ensure they're valid numbers
                const clickedTime = lastClicked ? parseInt(lastClicked) : 0;
                const updatedTime = lastUpdated || 0;

                // Use the most recent timestamp as primary sort criteria
                const primaryTime = Math.max(clickedTime, updatedTime);

                resumeItems.push({ 
                    imdbId, 
                    type: data.type || 'movie',
                    title: data.title,
                    poster: data.poster,
                    season: data.season,
                    episodeId: data.episode,
                    progress: (data.currentTime / data.duration) * 100,
                    currentTime: data.currentTime,
                    duration: data.duration,
                    lastClicked: clickedTime,
                    lastUpdated: updatedTime,
                    sortTime: primaryTime
                });
            }
        }
    }

    // Sort by most recent activity first (left to right: 1=most recent, 9=oldest)
    // Most recently watched will appear first (leftmost)
    resumeItems.sort((a, b) => {
        // Primary sort: by most recent timestamp (DESC - newest first)
        const timeDiff = b.sortTime - a.sortTime;
        if (timeDiff !== 0) return timeDiff;

        // Secondary sort: by lastUpdated if primary is same
        const updateDiff = b.lastUpdated - a.lastUpdated;
        if (updateDiff !== 0) return updateDiff;

        // Tertiary sort: by lastClicked if both previous are same
        const clickDiff = b.lastClicked - a.lastClicked;
        if (clickDiff !== 0) return clickDiff;

        // Final sort: by imdbId for consistency
        return a.imdbId.localeCompare(b.imdbId);
    });

    if (resumeItems.length > 0) {
        const container = document.createElement('div');
        container.className = 'resume-section';
        container.innerHTML = '<h2>Continue Watching</h2><div class="resume-items"></div>';

        const announcementSection = document.getElementById('announcementSection');
        announcementSection.parentNode.insertBefore(container, announcementSection);

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
                    resumeCard.className = 'resume-card';

                    // Calculate time remaining and format
                    const timeLeft = Math.max(0, item.duration - item.currentTime);
                    const formatTimeRemaining = (seconds) => {
                        const hours = Math.floor(seconds / 3600);
                        const mins = Math.floor((seconds % 3600) / 60);

                        if (hours > 0) {
                            return `${hours}h ${mins}m left`;
                        } else if (mins > 0) {
                            return `${mins}m left`;
                        } else if (seconds > 0) {
                            return `<1m left`;
                        } else {
                            return `Finished`;
                        }
                    };

                    const timeRemainingText = formatTimeRemaining(timeLeft);

                    // Format episode info for TV shows with time remaining
                    const episodeInfo = type === 'tv' ? 
                        `<div class="episode-info">
                            <span class="episode-season">S${item.season} E${item.episodeId}</span>
                            <span class="time-remaining">${timeRemainingText}</span>
                        </div>` : 
                        `<div class="episode-info">
                            <span class="episode-season">Movie</span>
                            <span class="time-remaining">${timeRemainingText}</span>
                        </div>`;

                    // Add episodes icon only for TV shows in continue watching
                    const episodesIcon = type === 'tv' ? 
                        `<button onclick="event.stopPropagation(); window.location.href='stream.html?imdb=${item.imdbId}&type=tv'" class="episodes-icon">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                            </svg>
                        </button>` : 
                        '';

                    resumeCard.innerHTML = `
                        <div class="poster-container">
                            <img src="${poster}" alt="${title}" class="movie-poster">
                            <div class="play-overlay">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                    <path d="M6 4v16l12-8z"/>
                                </svg>
                            </div>
                        </div>
                        ${episodesIcon}
                        <div class="movie-info">
                            <h3 class="movie-title">${title}</h3>
                            ${episodeInfo}
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${item.progress}%"></div>
                            </div>
                        </div>
                    `;

                    // Add click event listener with timestamp update
                    resumeCard.addEventListener('click', () => {
                        // Update the click timestamp to move this to the front
                        localStorage.setItem(`lastClicked_${item.imdbId}`, Date.now());

                        if (type === 'tv') {
                            window.location.href = `media.html?id=${item.imdbId}&season=${item.season}&episode=${item.episodeId}`;
                        } else {
                            window.location.href = `watch.html?id=${item.imdbId}&type=${type}`;
                        }
                    });
                    itemsContainer.appendChild(resumeCard);
                }
            } catch (error) {
                console.error("Error fetching resume item:", error);
            }
        });
    }
}

// Mouse drag functionality for sliders
function addDragFunctionality(slider) {
    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('active');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
        slider.style.cursor = 'grabbing';
        e.preventDefault(); // Prevent text selection
    });

    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.classList.remove('active');
        slider.style.cursor = 'grab';
    });

    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.classList.remove('active');
        slider.style.cursor = 'grab';
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // Scroll speed multiplier
        slider.scrollLeft = scrollLeft - walk;
    });

    // Set initial cursor style
    slider.style.cursor = 'grab';
}

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
    // Show home section by default
    showSection('home');

    displayResumeSection();
    displayWatchLaterSection();

    // Load explore content for when user switches to it
    setTimeout(() => {
        fetchCategoryData("action");
    }, 500);

    // Add search on Enter key
    document.getElementById("searchInput").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            searchMovies();
            closeSearch();
        }
    });

    // Close search on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeSearch();
        }
    });

    // Add type filter change handler
    document.getElementById("typeFilter").addEventListener("change", () => {
        fetchCategoryData(currentCategory);
    });

    // Add drag functionality to sliders on desktop
    setTimeout(() => {
        const trendingSlider = document.getElementById("trendingSlider");
        const resumeItems = document.querySelector(".resume-items");
        const categoriesSlider = document.querySelector(".categories-slider");

        if (trendingSlider) addDragFunctionality(trendingSlider);
        if (resumeItems) addDragFunctionality(resumeItems);
        if (categoriesSlider) addDragFunctionality(categoriesSlider);
    }, 1000); // Wait for content to load

    // Update user stats on page load
    setTimeout(() => {
        updateUserStats();
    }, 500);
});

    async function playNextEpisode() {
      saveProgress(); // Save before navigating
      const nextEp = await getNextEpisodeInfo();
      if (nextEp) {
        // Update click timestamp for recent tracking
        localStorage.setItem(`lastClicked_${watchState.imdbID}`, Date.now());

        // Immediately save next episode to continue watching with existing or default progress
        const existingProgress = JSON.parse(localStorage.getItem(`watchProgress_${watchState.imdbID}`)) || {};
        const progressData = {
          currentTime: Math.max(existingProgress.currentTime || 3, 3),
          duration: existingProgress.duration || 2700,
          title: watchState.title,
          poster: watchState.poster,
          type: watchState.type,
          season: nextEp.season,
          episode: nextEp.episode,
          lastUpdated: Date.now()
        };
        localStorage.setItem(`watchProgress_${watchState.imdbID}`, JSON.stringify(progressData));
        localStorage.setItem(`lastWatched-${watchState.imdbID}`, JSON.stringify({
          episodeId: nextEp.episode,
          season: nextEp.season,
          timestamp: Date.now()
        }));

        window.location.href = `media.html?id=${watchState.imdbID}&season=${nextEp.season}&episode=${nextEp.episode}`;
      } else {
        alert('No more episodes available');
      }
    }

    async function playPrevEpisode() {
      saveProgress(); // Save before navigating
      const prevEp = await getPrevEpisodeInfo();
      if (prevEp) {
        // Update click timestamp for recent tracking
        localStorage.setItem(`lastClicked_${watchState.imdbID}`, Date.now());

        // Immediately save previous episode to continue watching with existing or default progress
        const existingProgress = JSON.parse(localStorage.getItem(`watchProgress_${watchState.imdbID}`)) || {};
        const progressData = {
          currentTime: Math.max(existingProgress.currentTime || 3, 3),
          duration: existingProgress.duration || 2700,
          title: watchState.title,
          poster: watchState.poster,
          type: watchState.type,
          season: prevEp.season,
          episode: prevEp.episode,
          lastUpdated: Date.now()
        };
        localStorage.setItem(`watchProgress_${watchState.imdbID}`, JSON.stringify(progressData));
        localStorage.setItem(`lastWatched-${watchState.imdbID}`, JSON.stringify({
          episodeId: prevEp.episode,
          season: prevEp.season,
          timestamp: Date.now()
        }));

        window.location.href = `media.html?id=${watchState.imdbID}&season=${prevEp.season}&episode=${prevEp.episode}`;
      } else {
        alert('No previous episode available');
      }
    }
        // Settings functions
        function toggleSettings() {
            // Desktop settings removed - only show mobile settings
            showSection('settings');
        }

        function closeSettings() {
            // No longer needed for desktop panel
        }
        // Mobile settings tab switching
        function switchMobileTab(tabName) {
            // Remove active class from all mobile tabs and contents
            document.querySelectorAll('.settings-tab-mobile').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.settings-tab-content-mobile').forEach(content => {
                content.classList.remove('active');
            });

            // Add active class to selected tab and content
            document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
            document.getElementById(`${tabName}-mobile`).classList.add('active');
        }

        // Enhanced mobile settings functions
        function toggleMobileTransparent() {
            const toggle = document.getElementById('mobileTransparentToggle');
            const body = document.body;
            toggle.classList.toggle('active');
            body.classList.toggle('transparent');
            localStorage.setItem('transparentMode', body.classList.contains('transparent'));
        }

        function toggleMobileAutoplay() {
            const toggle = document.getElementById('mobileAutoplayToggle');
            toggle.classList.toggle('active');
            localStorage.setItem('autoplayEnabled', toggle.classList.contains('active'));
        }

        function toggleMobileSaveProgress() {
            const toggle = document.getElementById('mobileSaveProgressToggle');
            toggle.classList.toggle('active');
            localStorage.setItem('saveProgressEnabled', toggle.classList.contains('active'));
        }

        function toggleMobileDeveloperMode() {
            const toggle = document.getElementById('mobileDeveloperModeToggle');
            toggle.classList.toggle('active');
            const isEnabled = toggle.classList.contains('active');
            localStorage.setItem('developerMode', isEnabled);
            
            // Store in luminaSettings format for compatibility
            const settings = JSON.parse(localStorage.getItem('luminaSettings')) || {};
            settings.developerMode = isEnabled;
            localStorage.setItem('luminaSettings', JSON.stringify(settings));
        }

        function togglePreload() {
            const toggle = document.getElementById('mobilePreloadToggle');
            toggle.classList.toggle('active');
            localStorage.setItem('preloadNextEpisode', toggle.classList.contains('active'));
        }

        function toggleMobileHideAnnouncement() {
            const toggle = document.getElementById('mobileHideAnnouncementToggle');
            toggle.classList.toggle('active');
            const isHidden = toggle.classList.contains('active');
            localStorage.setItem('hideAnnouncement', isHidden);
            
            const announcementSection = document.getElementById('announcementSection');
            if (announcementSection) {
                announcementSection.style.display = isHidden ? 'none' : 'block';
            }
        }

        function toggleMobileHideTrending() {
            const toggle = document.getElementById('mobileHideTrendingToggle');
            toggle.classList.toggle('active');
            const isHidden = toggle.classList.contains('active');
            localStorage.setItem('hideTrending', isHidden);
            
            const trendingSection = document.querySelector('.trending-section');
            if (trendingSection) {
                trendingSection.style.display = isHidden ? 'none' : 'block';
            }
        }

        function toggleMobileHideGenres() {
            const toggle = document.getElementById('mobileHideGenresToggle');
            toggle.classList.toggle('active');
            const isHidden = toggle.classList.contains('active');
            localStorage.setItem('hideGenres', isHidden);
            
            const genresSection = document.querySelector('.categories-section');
            if (genresSection) {
                genresSection.style.display = isHidden ? 'none' : 'block';
            }
        }

        function toggleMobileHideMovies() {
            const toggle = document.getElementById('mobileHideMoviesToggle');
            toggle.classList.toggle('active');
            const isHidden = toggle.classList.contains('active');
            localStorage.setItem('hideMovies', isHidden);
            
            const moviesGrid = document.getElementById('movies');
            if (moviesGrid) {
                moviesGrid.style.display = isHidden ? 'none' : 'grid';
            }
        }

        function selectMobileColor(color) {
            // Remove active class from all color cards
            document.querySelectorAll('.color-card').forEach(card => {
                card.classList.remove('active');
            });
            
            // Add active class to selected color
            const selectedCard = document.querySelector(`[data-color="${color}"]`);
            if (selectedCard) {
                selectedCard.classList.add('active');
            }
            
            // Apply the color theme
            applyColorTheme(color);
            localStorage.setItem('accentColor', color);
        }

        function exportSettings() {
            const settings = {
                transparentMode: localStorage.getItem('transparentMode'),
                autoplayEnabled: localStorage.getItem('autoplayEnabled'),
                saveProgressEnabled: localStorage.getItem('saveProgressEnabled'),
                hideFilters: localStorage.getItem('hideFilters'),
                hideAnnouncement: localStorage.getItem('hideAnnouncement'),
                hideTrending: localStorage.getItem('hideTrending'),
                hideGenres: localStorage.getItem('hideGenres'),
                hideMovies: localStorage.getItem('hideMovies'),
                developerMode: localStorage.getItem('developerMode'),
                accentColor: localStorage.getItem('accentColor'),
                preloadNextEpisode: localStorage.getItem('preloadNextEpisode'),
                luminaSettings: localStorage.getItem('luminaSettings')
            };

            const dataStr = JSON.stringify(settings, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'lumina-settings.json';
            link.click();
            URL.revokeObjectURL(url);
        }

        function importSettings() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        try {
                            const settings = JSON.parse(e.target.result);
                            Object.entries(settings).forEach(([key, value]) => {
                                if (value !== null) {
                                    localStorage.setItem(key, value);
                                }
                            });
                            location.reload();
                        } catch (error) {
                            alert('Invalid settings file');
                        }
                    };
                    reader.readAsText(file);
                }
            };
            input.click();
        }

        function updateUserStats() {
            // Count movies watched
            let moviesWatched = 0;
            let episodesWatched = 0;
            let totalHours = 0;

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.startsWith('watchProgress_')) {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (data.type === 'movie') {
                        moviesWatched++;
                    } else {
                        episodesWatched++;
                    }
                    totalHours += (data.duration || 0) / 3600;
                }
            }

            const bookmarks = JSON.parse(localStorage.getItem('watchLater')) || [];

            // Update UI
            const moviesCount = document.getElementById('moviesWatchedCount');
            const episodesCount = document.getElementById('episodesWatchedCount');
            const hoursCount = document.getElementById('hoursWatchedCount');
            const bookmarksCount = document.getElementById('bookmarksCount');

            if (moviesCount) moviesCount.textContent = moviesWatched;
            if (episodesCount) episodesCount.textContent = episodesWatched;
            if (hoursCount) hoursCount.textContent = Math.round(totalHours);
            if (bookmarksCount) bookmarksCount.textContent = bookmarks.length;
        }

        // New enhanced settings functions
        function toggleExtraAccentMods() {
            const toggle = document.getElementById('mobileExtraAccentToggle');
            toggle.classList.toggle('active');
            const isEnabled = toggle.classList.contains('active');
            localStorage.setItem('extraAccentMods', isEnabled);
            
            if (isEnabled) {
                document.body.classList.add('extra-accent-mode');
                applyExtraAccentStyles();
            } else {
                document.body.classList.remove('extra-accent-mode');
                removeExtraAccentStyles();
            }
        }

        function toggleEnhancedAnimations() {
            const toggle = document.getElementById('mobileAnimationsToggle');
            toggle.classList.toggle('active');
            const isEnabled = toggle.classList.contains('active');
            localStorage.setItem('enhancedAnimations', isEnabled);
            
            if (isEnabled) {
                document.body.classList.add('enhanced-animations');
            } else {
                document.body.classList.remove('enhanced-animations');
            }
        }

        function toggleDynamicBlur() {
            const toggle = document.getElementById('mobileBlurToggle');
            toggle.classList.toggle('active');
            const isEnabled = toggle.classList.contains('active');
            localStorage.setItem('dynamicBlur', isEnabled);
            
            if (isEnabled) {
                document.body.classList.add('dynamic-blur');
            } else {
                document.body.classList.remove('dynamic-blur');
            }
        }

        function toggleSkipIntro() {
            const toggle = document.getElementById('mobileSkipIntroToggle');
            toggle.classList.toggle('active');
            localStorage.setItem('skipIntro', toggle.classList.contains('active'));
        }

        function toggleTheaterMode() {
            const toggle = document.getElementById('mobileTheaterToggle');
            toggle.classList.toggle('active');
            const isEnabled = toggle.classList.contains('active');
            localStorage.setItem('theaterMode', isEnabled);
            
            if (isEnabled) {
                document.body.classList.add('theater-mode');
            } else {
                document.body.classList.remove('theater-mode');
            }
        }

        function toggleSmartRecommendations() {
            const toggle = document.getElementById('mobileSmartRecsToggle');
            toggle.classList.toggle('active');
            localStorage.setItem('smartRecommendations', toggle.classList.contains('active'));
        }

        function toggleWatchParty() {
            const toggle = document.getElementById('mobileWatchPartyToggle');
            toggle.classList.toggle('active');
            localStorage.setItem('watchParty', toggle.classList.contains('active'));
        }

        function applyExtraAccentStyles() {
            const style = document.createElement('style');
            style.id = 'extra-accent-styles';
            style.textContent = `
                .extra-accent-mode .movie-card:hover {
                    border: 2px solid var(--accent-primary) !important;
                    box-shadow: 0 0 20px rgba(139, 92, 246, 0.4) !important;
                }
                .extra-accent-mode .nav-item.active {
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)) !important;
                }
                .extra-accent-mode .filter-input:focus {
                    border-color: var(--accent-primary) !important;
                    box-shadow: 0 0 10px rgba(139, 92, 246, 0.3) !important;
                }
                .extra-accent-mode .category-btn.active {
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)) !important;
                }
                .extra-accent-mode .resume-card:hover .play-overlay {
                    box-shadow: 0 0 25px var(--accent-primary) !important;
                }
                .extra-accent-mode .search-toggle-btn:hover,
                .extra-accent-mode .settings-btn:hover {
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)) !important;
                    border-color: var(--accent-primary) !important;
                }
                .extra-accent-mode .trending-slider .movie-card:hover {
                    border: 2px solid var(--accent-primary) !important;
                    box-shadow: 0 0 20px rgba(139, 92, 246, 0.4) !important;
                }
                .extra-accent-mode .bookmark-btn:hover {
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)) !important;
                    transform: scale(1.15) !important;
                }
                .extra-accent-mode .navbar {
                    border-bottom: 1px solid var(--accent-primary) !important;
                }
                .extra-accent-mode .bottom-nav {
                    border-top: 1px solid var(--accent-primary) !important;
                }
                .extra-accent-mode .announcement-section {
                    border: 1px solid rgba(139, 92, 246, 0.3) !important;
                }
                .extra-accent-mode .resume-section h2,
                .extra-accent-mode .trending-section h2,
                .extra-accent-mode .categories-section h2 {
                    background: linear-gradient(45deg, var(--accent-primary), var(--accent-secondary)) !important;
                    -webkit-background-clip: text !important;
                    -webkit-text-fill-color: transparent !important;
                }
                .extra-accent-mode .search-container {
                    border: 1px solid rgba(139, 92, 246, 0.3) !important;
                }
                .extra-accent-mode .enhanced-toggle.active {
                    box-shadow: 0 0 15px rgba(139, 92, 246, 0.5) !important;
                }
            `;
            document.head.appendChild(style);
        }

        function removeExtraAccentStyles() {
            const existingStyle = document.getElementById('extra-accent-styles');
            if (existingStyle) {
                existingStyle.remove();
            }
        }

        function loadEnhancedMobileSettings() {
            // Load all mobile setting states including new ones
            const toggles = {
                'mobileTransparentToggle': localStorage.getItem('transparentMode') === 'true',
                'mobileAutoplayToggle': localStorage.getItem('autoplayEnabled') !== 'false',
                'mobileSaveProgressToggle': localStorage.getItem('saveProgressEnabled') !== 'false',
                'mobileDeveloperModeToggle': localStorage.getItem('developerMode') === 'true',
                'mobilePreloadToggle': localStorage.getItem('preloadNextEpisode') === 'true',
                'mobileHideAnnouncementToggle': localStorage.getItem('hideAnnouncement') === 'true',
                'mobileHideTrendingToggle': localStorage.getItem('hideTrending') === 'true',
                'mobileHideGenresToggle': localStorage.getItem('hideGenres') === 'true',
                'mobileHideMoviesToggle': localStorage.getItem('hideMovies') === 'true',
                'mobileExtraAccentToggle': localStorage.getItem('extraAccentMods') === 'true',
                'mobileAnimationsToggle': localStorage.getItem('enhancedAnimations') === 'true',
                'mobileBlurToggle': localStorage.getItem('dynamicBlur') === 'true',
                'mobileSkipIntroToggle': localStorage.getItem('skipIntro') === 'true',
                'mobileTheaterToggle': localStorage.getItem('theaterMode') === 'true',
                'mobileSmartRecsToggle': localStorage.getItem('smartRecommendations') === 'true',
                'mobileWatchPartyToggle': localStorage.getItem('watchParty') === 'true'
            };

            Object.entries(toggles).forEach(([id, isActive]) => {
                const element = document.getElementById(id);
                if (element) {
                    if (isActive) {
                        element.classList.add('active');
                    } else {
                        element.classList.remove('active');
                    }
                }
            });

            // Apply effects based on settings
            if (localStorage.getItem('extraAccentMods') === 'true') {
                document.body.classList.add('extra-accent-mode');
                applyExtraAccentStyles();
            }
            
            if (localStorage.getItem('enhancedAnimations') === 'true') {
                document.body.classList.add('enhanced-animations');
            }
            
            if (localStorage.getItem('dynamicBlur') === 'true') {
                document.body.classList.add('dynamic-blur');
            }
            
            if (localStorage.getItem('theaterMode') === 'true') {
                document.body.classList.add('theater-mode');
            }

            // Load accent color
            const savedColor = localStorage.getItem('accentColor') || 'purple';
            const colorCards = document.querySelectorAll('.color-card');
            colorCards.forEach(card => {
                card.classList.remove('active');
                if (card.dataset.color === savedColor) {
                    card.classList.add('active');
                }
            });
        }
