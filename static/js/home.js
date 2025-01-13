async function buscarEquipo() {
    const searchTerm = document.getElementById('Buscador').value.trim();

    if (!searchTerm) return;

    try {
        // Realizar una solicitud al servidor para buscar equipos
        const response = await fetch(`/api/equipos/buscar?nombre=${encodeURIComponent(searchTerm)}`);
        const equipos = await response.json();

        // Mostrar los resultados
        const teamContainer = document.getElementById('teamContainer');
        teamContainer.innerHTML = '';

        if (equipos.length > 0) {
            equipos.forEach(equipo => {
                const teamCard = document.createElement('div');
                teamCard.classList.add('team-card');
                teamCard.setAttribute('onclick', `window.location.href='/equipo/${equipo.nombre}'`);
                teamCard.innerHTML = `
                    <img src="${equipo.Logo}" alt="${equipo.nombre}">
                    <h3>${equipo.nombre}</h3>
                `;
                teamContainer.appendChild(teamCard);
            });
        } else {
            teamContainer.innerHTML = ``;
        }
    } catch (error) {
        console.error("Error al buscar el equipo:", error);
    }
}

// Añadir evento para el icono de búsqueda
document.getElementById('IconoBusqueda').addEventListener('click', buscarEquipo);

// Añadir evento para presionar "Enter" en el campo de búsqueda
document.getElementById('Buscador').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        buscarEquipo();
    }
});