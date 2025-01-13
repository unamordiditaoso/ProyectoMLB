function toggleFavorite(nombreEquipo) {
    const star = document.getElementById('favorite-star');
    star.classList.toggle('favorito');
    const response = fetch(`/addfavorito?equipo=${encodeURIComponent(nombreEquipo)}`);
}