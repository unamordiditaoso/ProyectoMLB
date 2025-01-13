document.addEventListener('DOMContentLoaded', () => {
    const prevDiaBtn = document.getElementById('prevDia');
    const nextDiaBtn = document.getElementById('nextDia');
    const fechaActualSpan = document.getElementById('fechaActual');

    // Cambiar la fecha en el frontend
    const cambiarFecha = (dias) => {
        const fechaActual = new Date(fechaActualSpan.textContent);
        fechaActual.setDate(fechaActual.getDate() + dias);
        const nuevaFecha = fechaActual.toISOString().split('T')[0];

        // Actualizar el texto en el frontend
        fechaActualSpan.textContent = nuevaFecha;

        // Hacer una solicitud al backend con la nueva fecha
        obtenerPartidosPorFecha(nuevaFecha);
    };

    // Manejar clic en botones
    prevDiaBtn.addEventListener('click', () => cambiarFecha(-1));
    nextDiaBtn.addEventListener('click', () => cambiarFecha(1));

    // Función para obtener partidos por fecha
    const obtenerPartidosPorFecha = async (fecha) => {
        try {
            const response = await fetch(`/partidos/?fecha=${fecha}`);
            const partidos = await response.json();

            // Actualizar la vista con los nuevos partidos
            actualizarPartidos(partidos);
        } catch (error) {
            console.error('Error al obtener los partidos:', error);
        }
    };

    // Función para actualizar la lista de partidos en el DOM
    const actualizarPartidos = (partidos) => {
        const container = document.querySelector('.partidos-container');
        container.innerHTML = '';

        partidos.forEach((partido) => {
            const card = document.createElement('div');
            card.classList.add('partido-card');
            card.setAttribute('onclick', `window.location.href='/partido/${partido._id}'`);
            card.innerHTML = `
                <p class="partido-card-p">Fecha: ${partido.fecha}</p>
                <p class="game-time">Hora: ${partido.hora}</p>
                <div class="escudo-container">
                    <img class="escudo equipo-local" src="${partido.equipoLocal.Logo}" alt="${partido.equipoLocal.nombre}">
                    <h3>${partido.equipoLocal.nombre} vs ${partido.equipoVisitante.nombre}</h3>
                    <img class="escudo equipo-visitante" src="${partido.equipoVisitante.Logo}" alt="${partido.equipoVisitante.nombre}">
                </div>
                <p class="resultado">${partido.marcadorLocal} - ${partido.marcadorVisitante}</p>
                
            `;
            container.appendChild(card);
        });
    };
});