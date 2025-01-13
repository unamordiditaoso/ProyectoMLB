const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const app = express();
const cors = require('cors');

app.use(cors({
    origin: 'http://server:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
}));

const Equipo = require('../modelos/Equipo');
const Partido = require('../modelos/Partido');

// Cadena de conexión a MongoDB Atlas
const uri = process.env.MONGO_URI;

// Conectar a MongoDB Atlas
mongoose.connect(uri)
    .then(() => console.log("Conectado a MongoDB Atlas"))
    .catch((error) => console.log("Error de conexión a MongoDB Atlas:", error));

// URL de la API de TheSportsDB
const apiUrl = "https://www.thesportsdb.com/api/v1/json/3/search_all_teams.php?l=MLB";

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Función para obtener datos de la API y almacenarlos en MongoDB
async function obtenerEquipos() {
    try {
        const response = await axios.get(apiUrl);
        const equipos = response.data.teams;

        if (equipos) {
            // Procesar y almacenar los equipos en MongoDB
            for (const equipo of equipos) {
                // Verificar si el equipo ya existe en la base de datos por nombre
                const equipoExistente = await Equipo.findOne({ nombre: equipo.strTeam || "Desconocido" });

                if (equipoExistente) {
                    console.log(`El equipo ${equipo.strTeam || "Desconocido"} ya existe en la base de datos.`);
                    continue; // No hacer nada y continuar con el siguiente equipo
                }

                // Si no existe, crear un nuevo equipo y guardarlo
                const nuevoEquipo = new Equipo({
                    nombre: equipo.strTeam || "Desconocido",
                    abreviacion: equipo.strTeamShort || "N/A",
                    estadio: equipo.strStadium || "Desconocido",
                    capacidad: equipo.intStadiumCapacity || "Desconocido",
                    ubicacion: equipo.strLocation || "Desconocido",
                    AnoCreacion: equipo.intFormedYear || "N/A",
                    Logo: equipo.strBadge || "N/A"
                });

                await nuevoEquipo.save();
                console.log(`Equipo ${equipo.strTeam || "Desconocido"} procesado y guardado en MongoDB.`);
            }
            console.log("Equipos procesados y guardados en MongoDB.");
        }
    } catch (error) {
        console.error("Error al obtener los datos de la API:", error);
    }
}

async function obtenerPartidos(temporada) {
    try {
        // Obtener todos los equipos de la base de datos
        const equipos = await Equipo.find();

        if (!equipos.length) {
            console.error("No hay equipos en la base de datos para generar partidos.");
            return;
        }

        const partidos = [];
        const totalequipos = equipos.length;

        for (let i = 0; i < totalequipos; i++) {
            for (let j = 0; j < totalequipos; j++) {
                if (i != j) {
                    const equipoLocal = equipos[i].nombre;
                    const equipoVisitante = equipos[j].nombre;
                    
                    const url = `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${equipoLocal} vs ${equipoVisitante}&s=${temporada}`;

                    // Hacer la solicitud a la API para obtener información del partido
                    try {
                        const response = await axios.get(url);
                        const events = response.data.event;

                        if (events && events.length > 0) {
                            events.forEach(async event => {

                                const result = event.strResult || '';

                                // Crear una función para extraer los innings, hits y errores
                                const parseResult = (result) => {
                                    const teams = result.split("<br><br>");
                                    if (teams.length !== 2) return null; // Si no hay dos equipos, retornar null

                                    const homeTeam = teams[0];
                                    const awayTeam = teams[1];

                                    // Extraer innings, hits y errores de la cadena
                                    const extractInnings = (teamResult) => {
                                        const innings = teamResult.match(/Innings:<br>([0-9 ]+)/);
                                        const hits = teamResult.match(/Hits: (\d+)/);
                                        const errors = teamResult.match(/Errors: (\d+)/);

                                        return {
                                            innings: innings ? innings[1].trim().split(' ') : [],
                                            hits: hits ? parseInt(hits[1]) : 0,
                                            errors: errors ? parseInt(errors[1]) : 0
                                        };
                                    };

                                    return {
                                        homeTeamResult: extractInnings(homeTeam),
                                        awayTeamResult: extractInnings(awayTeam)
                                    };
                                };

                                // Llamar a la función para extraer los resultados
                                const parsedResults = parseResult(result);

                                const partido = {
                                    equipoLocal: await Equipo.findOne({ nombre: event.strHomeTeam }),
                                    equipoVisitante: await Equipo.findOne({ nombre: event.strAwayTeam }),
                                    marcadorLocal: event.intHomeScore ? parseInt(event.intHomeScore) : null,
                                    marcadorVisitante: event.intAwayScore ? parseInt(event.intAwayScore) : null,
                                    temporada: parseInt(event.strSeason),
                                    ronda: event.intRound ? parseInt(event.intRound) : null,
                                    fecha: event.dateEvent || "Fecha desconocida",
                                    hora: event.strTime || "Hora desconocida",
                                    estado: event.strStatus || "Estado desconocido",
                                    resultado: parsedResults
                                };
                                partidos.push(partido);
                                console.log("Partido procesado:", partido);
                            });
                        } else {
                            console.log("No se encontraron eventos para la URL:", url);
                        }
                    } catch (error) {
                        console.error(`Error al obtener los datos: ${error.message}`);
                    }
                    
                    await sleep(700);
                }
            }
            
        }

        // Insertar partidos en la colección
        if (partidos.length) {
            // Crear una lista para los partidos no repetidos
            const partidosNoRepetidos = [];
        
            for (const partido of partidos) {

                const partidoExistente = await mongoose.connection.db.collection('partidos').findOne({
                    equipoLocal: partido.equipoLocal,
                    equipoVisitante: partido.equipoVisitante,
                    fecha: partido.fecha,
                    hora: partido.hora,
                });
            
                if (!partidoExistente) {
                    partidosNoRepetidos.push(partido);
                } else {
                    console.log(`Partido repetido: ${partido.equipoLocal.nombre} vs ${partido.equipoVisitante.nombre} en ${partido.fecha} ${partido.hora}`);
                    
                    const resultadoDiferente = (
                        partidoExistente.marcadorLocal !== partido.marcadorLocal ||
                        partidoExistente.marcadorVisitante !== partido.marcadorVisitante
                    );
            
                    if (resultadoDiferente) {
                        console.log(`Actualizando resultado del partido: ${partido.equipoLocal.nombre} vs ${partido.equipoVisitante.nombre}`);
                        
                        // Actualizar el resultado del partido en la base de datos
                        await mongoose.connection.db.collection('partidos').updateOne(
                            { _id: partidoExistente._id },
                            {
                                $set: {
                                    marcadorLocal: partido.marcadorLocal,
                                    marcadorVisitante: partido.marcadorVisitante,
                                    estado: partido.estado,
                                    resultado: partido.resultado
                                }
                            }
                        );
                    }
                }
            }
        
            // Insertar solo los partidos no repetidos
            if (partidosNoRepetidos.length) {
                const result = await mongoose.connection.db.collection('partidos').insertMany(partidosNoRepetidos);
                console.log(`${result.insertedCount} partidos insertados en la base de datos.`);
            }
        } else {
            console.log("No se generaron partidos para insertar.");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}

async function actualizarPartidosPorFecha(fecha) {
    try {
        // Obtener los partidos existentes en la base de datos para la fecha especificada
        const partidosEnBD = await Partido.find({ fecha });

        if (!partidosEnBD.length) {
            console.log(`No se encontraron partidos en la base de datos para la fecha ${fecha}`);
            return;
        }

        console.log(`Se encontraron ${partidosEnBD.length} partidos para la fecha ${fecha}. Actualizando...`);

        for (const partido of partidosEnBD) {
            const equipoLocal = partido.equipoLocal.nombre;
            const equipoVisitante = partido.equipoVisitante.nombre;
            const temporada = partido.temporada;

            // Consultar la API para obtener los datos actualizados
            const url = `https://www.thesportsdb.com/api/v1/json/3/searchevents.php?e=${equipoLocal} vs ${equipoVisitante}&s=${temporada}`;
            try {
                const response = await axios.get(url);
                const events = response.data.event;

                if (events && events.length > 0) {
                    const event = events[0]; // Asumimos que el primer resultado es el relevante

                    const result = event.strResult || '';

                    // Crear una función para extraer los innings, hits y errores
                    const parseResult = (result) => {
                        const teams = result.split("<br><br>");
                        if (teams.length !== 2) return null;

                        const extractInnings = (teamResult) => {
                            const innings = teamResult.match(/Innings:<br>([0-9 ]+)/);
                            const hits = teamResult.match(/Hits: (\d+)/);
                            const errors = teamResult.match(/Errors: (\d+)/);

                            return {
                                innings: innings ? innings[1].trim().split(' ') : [],
                                hits: hits ? parseInt(hits[1]) : 0,
                                errors: errors ? parseInt(errors[1]) : 0
                            };
                        };

                        return {
                            homeTeamResult: extractInnings(teams[0]),
                            awayTeamResult: extractInnings(teams[1])
                        };
                    };

                    const parsedResults = parseResult(result);

                    // Verificar si hay diferencias en los datos
                    const resultadoDiferente = (
                        partido.marcadorLocal !== parseInt(event.intHomeScore) ||
                        partido.marcadorVisitante !== parseInt(event.intAwayScore)
                    );

                    if (resultadoDiferente) {
                        console.log(`Actualizando partido: ${equipoLocal} vs ${equipoVisitante}`);

                        // Actualizar el partido en la base de datos
                        await Partido.updateOne(
                            { _id: partido._id },
                            {
                                $set: {
                                    marcadorLocal: parseInt(event.intHomeScore),
                                    marcadorVisitante: parseInt(event.intAwayScore),
                                    estado: event.strStatus || "Estado desconocido",
                                    resultado: parsedResults
                                }
                            }
                        );
                    } else {
                        console.log(`El partido ${equipoLocal} vs ${equipoVisitante} ya está actualizado.`);
                    }
                } else {
                    console.log(`No se encontró información en la API para el partido ${equipoLocal} vs ${equipoVisitante}`);
                }
            } catch (error) {
                console.error(`Error al consultar la API para ${equipoLocal} vs ${equipoVisitante}: ${error.message}`);
            }

        }

        console.log("Actualización completada.");
    } catch (error) {
        console.error(`Error al actualizar partidos por fecha: ${error.message}`);
    }
}

app.get('/api/equipos', async (req, res) => {
    try {
        const equipos = await Equipo.find();
        res.json(equipos);
    } catch (error) {
        res.status(500).send('Error al obtener los equipos');
    }
});

app.get('/api/equipos/buscar', async (req, res) => {
    const searchTerm = req.query.nombre;

    try {
        if (!searchTerm) {
            return res.status(400).json({ message: "Se debe proporcionar un nombre para la búsqueda" });
        }

        const equipos = await Equipo.find({
            nombre: { $regex: searchTerm, $options: 'i' }
        });

        res.json(equipos);
    } catch (error) {
        console.error("Error en la búsqueda de equipos:", error);
        res.status(500).json({ message: "Error en la búsqueda de equipos" });
    }
});


app.get('/api/equipos/:nombre', async (req, res) => {
    try {
        const nombre = req.params.nombre;

        const equipo = await Equipo.findOne({ nombre: nombre });
        if (equipo) {
            res.json(equipo);
        } else {
            res.status(404).send('Equipo no encontrado');
        }
    } catch (error) {
        res.status(500).send('Error al obtener el equipo');
    }
});

app.get('/api/partidos', async (req, res) => {
    const fecha = req.query.fecha;

    if (!fecha) {
        return res.status(400).json({ message: "Se debe proporcionar una fecha." });
    }

    try {
        const partidos = await mongoose.connection.db.collection('partidos').find({
            fecha: { $eq: fecha } 
        }).toArray();

        // Ordenar los partidos por hora
        partidos.sort((a, b) => {
            const horaA = a.hora ? new Date(`2025-01-01T${a.hora}Z`) : new Date(0); // Maneja casos sin hora
            const horaB = b.hora ? new Date(`2025-01-01T${b.hora}Z`) : new Date(0);
            return horaA - horaB;
        });

        res.json(partidos);
        
    } catch (error) {
        console.error('Error al obtener los partidos:', error);
        res.status(500).json({ message: "Error al obtener los partidos." });
    }
});

app.get('/api/partidos/:equipo', async (req, res) => {
    
    const equipo = req.params.equipo;
    
    const fechaActual = new Date();

    if (!equipo) {
        return res.status(400).json({ message: "Se debe proporcionar un equipo." });
    }

    try {
        const partidos = await mongoose.connection.db.collection('partidos').find({
            $or: [
                { 'equipoLocal.nombre': equipo },
                { 'equipoVisitante.nombre': equipo }
            ]
        }).toArray();

        const partidosPasados = partidos
            .filter(partido => new Date(partido.fecha) < fechaActual)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha)) 
            .slice(0, 5);

        const partidosPasadosInversos = partidosPasados.reverse();
        
        const partidosFuturos = partidos
            .filter(partido => new Date(partido.fecha) >= fechaActual)
            .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
            .slice(0, 5);
        
        const partidosCombinados = [...partidosPasadosInversos, ...partidosFuturos];

        res.json(partidosCombinados);
        
    } catch (error) {
        console.error('Error al obtener la información del equipo:', error);
        res.status(500).json({ message: "Error interno del servidor." });
    }
});

app.get('/api/partido/:id', async (req, res) => {
    try {
        const ID = req.params.id;

        const partido = await Partido.findById(ID);
        
        if (partido) {
            res.json(partido);
        } else {
            res.status(404).send('Partido no encontrado');
        }
    } catch (error) {
        res.status(500).send('Error al obtener el partido');
    }
});

app.get('/api/clasificacion', async (req, res) => {
    try {
        const temporada = parseInt(req.query.temporada);
        // Obtener todos los partidos de la base de datos
        const partidos = await mongoose.connection.db.collection('partidos').find({ ronda: 0, temporada: temporada }).toArray();

        // Crear un objeto para almacenar las estadísticas de cada equipo
        const clasificacion = {};

        partidos.forEach(partido => {
            
            const local = partido.equipoLocal.nombre;
            const visitante = partido.equipoVisitante.nombre;

            const logoL = partido.equipoLocal.Logo;
            const logoV = partido.equipoVisitante.Logo;
        
            const marcadorLocal = partido.marcadorLocal;
            const marcadorVisitante = partido.marcadorVisitante;
            
            if (!clasificacion[local]) {
                clasificacion[local] = {
                    logo: logoL,
                    nombre: local,
                    V: 0, 
                    D: 0, 
                    CA: 0, 
                    CP: 0
                };
            }
            if (!clasificacion[visitante]) {
                clasificacion[visitante] = {
                    logo: logoV,
                    nombre: visitante, 
                    V: 0, 
                    D: 0, 
                    CA: 0, 
                    CP: 0
                };
            }
            clasificacion[local].CA += marcadorLocal;
            clasificacion[local].CP += marcadorVisitante;
            clasificacion[visitante].CA += marcadorVisitante;
            clasificacion[visitante].CP += marcadorLocal;

            if (marcadorLocal > marcadorVisitante) {
                clasificacion[local].V++;
                clasificacion[visitante].D++;
            } else if (marcadorLocal < marcadorVisitante) {
                clasificacion[visitante].V++;
                clasificacion[local].D++;
            }
        });

        const tablaClasificacion = Object.values(clasificacion).sort((a, b) => {
            if (b.V !== a.V) return b.V - a.V;
            const diffA = a.CA - a.CP;
            const diffB = b.CA - b.CP;
            if (diffB !== diffA) return diffB - diffA;
            if (b.CA !== a.CA) return b.CA - a.CA;
            return a.nombre.localeCompare(b.nombre);
        });
        res.json(tablaClasificacion);
    } catch (error) {
        console.error('Error al calcular la clasificación:', error.message);
        res.status(500).json({ message: 'Error al calcular la clasificación' });
    }
});

let isUpdating = false;

async function iniciarActualizacionAutomatica() {
    if (isUpdating) {
        return; // Si ya está ejecutándose, no la inicies de nuevo
    }
    isUpdating = true;
    try {
        const fechaActual = new Date().toISOString().split('T')[0];
        const diaAnterior = new Date();
        diaAnterior.setDate(diaAnterior.getDate() - 1);
        const fechaAnterior = diaAnterior.toISOString().split('T')[0];
        actualizarPartidosPorFecha(fechaActual);
        actualizarPartidosPorFecha(fechaAnterior);
    } catch (error) {
        console.error("Error en la actualización automática:", error);
    } finally {
        isUpdating = false
    }
}

setInterval(() => {
    iniciarActualizacionAutomatica();
}, 10 * 60 * 1000);



// Iniciar el servidor del microservicio
app.listen(process.env.PORT, () => {
    console.log(`Microservicio de datos deportivos corriendo en http://localhost:${process.env.PORT}`);
});

process.on('SIGTERM', () => {
    console.log('Recibiendo señal de apagado, cerrando conexiones...');

    mongoose.connection.close(() => {
      console.log('Conexión con la base de datos cerrada');
      server.close(() => {
        console.log('Servidor detenido correctamente');
        process.exit(0);
      });
    });
  });

//obtenerEquipos();
//obtenerPartidos(2021);
iniciarActualizacionAutomatica();