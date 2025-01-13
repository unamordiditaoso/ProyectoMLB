const axios = require('axios');
const express = require('express');
const Redis = require('ioredis');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const app = express();

const swaggerDocument = YAML.load(path.join(__dirname, 'openapi.yaml'));

app.set('view engine', 'ejs');
app.set('views', 'views');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use(express.static('static'));
app.use(cookieParser());

app.use(express.urlencoded({ extended: true }));

const redis = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
  });

app.get('/', async (req, res) => {
    try {
        res.render('login', { mensaje: '' });
    } catch (error) {
        res.status(500).send('Error al acceder a la ventana Login');
    }
});

app.get('/registro', async (req, res) => {
    try {
        res.render('registro' , { mensaje: '' });
    } catch (error) {
        res.status(500).send('Error al acceder a la ventana Registro');
    }
});

app.get('/home', async (req, res) => {
    try {
        let fav = false;
        const response = await axios.get('http://servicio-datos:6000/api/equipos');
        const equipos = response.data;

        res.render('home', {teams: equipos, fav});
    } catch (error) {
        console.error('Error al obtener los equipos:', error.message);
        res.status(500).send('Error al obtener los equipos');
    }
});

app.get('/api/equipos/buscar', async (req, res) => {
    const searchTerm = req.query.nombre;

    try {
        if (!searchTerm) {
            return res.status(400).json({ message: "Se debe proporcionar un nombre para la búsqueda" });
        }

        const response = await axios.get(`http://servicio-datos:6000/api/equipos/buscar?nombre=${encodeURIComponent(searchTerm)}`);

        const equipos = response.data;
        res.json(equipos);
    } catch (error) {
        console.error('Error al buscar equipos:', error.message);
        res.status(500).send('Error al buscar equipos');
    }
});

app.get('/equipo/:nombre', async (req, res) => {
    try {
        const nombreEquipo = req.params.nombre;
        
        const responseE = await axios.get(`http://servicio-datos:6000/api/equipos/${nombreEquipo}`);
        
        const equipo = responseE.data;

        if (!equipo) {
            return res.status(404).send('Equipo no encontrado');
        }

        const responseP = await axios.get(`http://servicio-datos:6000/api/partidos/${nombreEquipo}`);
        
        const partidos = responseP.data;
        
        let fav = false

        const token = req.cookies.authToken;

        const responseF = await axios.post('http://flask:5000/getfavorito', 
            {
                nombreEquipo: nombreEquipo
            }, 
            {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
        
        if (responseF.status == 200) {
            fav = true;
        } 

        res.render('equipo', { equipo, partidos, fav });
    } catch (error) {
        console.error('Error al obtener información del equipo:', error.message);
        res.status(500).send('Error interno del servidor');
    }
});

app.get('/partidos', async (req, res) => {
    try {
        const today = "2024-04-17";

        const fecha = req.query.fecha || today;

        const response = await axios.get(`http://servicio-datos:6000/api/partidos?fecha=${fecha}`);

        const partidos = response.data;

        if(req.query.fecha == fecha){
            res.json(response.data);
        } else{
            res.render('partidos', { partidos, fechaActual: today });
        }
    } catch (error) {
        console.error('Error al obtener los partidos:', error.message);
        res.status(500).send('Error al obtener los partidos');
    }
});

app.get('/partido/:id', async (req, res) => {
    try {
        const partidoID = req.params.id;

        const response = await axios.get(`http://servicio-datos:6000/api/partido/${partidoID}`);

        const partido = response.data;
        
        if (!partido) {
            return res.status(404).send('Partido no encontrado');
        }

        const maxInnings = Math.max(
            partido.resultado.homeTeamResult.innings.length,
            partido.resultado.awayTeamResult.innings.length
        );

        res.render('partido', { partido, maxInnings });
    } catch (error) {
        console.error('Error al obtener información del partido:', error.message);
        res.status(500).send('Error interno del servidor');
    }
});

app.get('/clasificacion', async (req, res) => {
    try {
    
        const temporada = req.query.temporada || '2024'

        const key = `clasificacion:${temporada}`;
        let clasificacion = await redis.get(key);
        
        if (!clasificacion) {
            const response = await axios.get(`http://servicio-datos:6000/api/clasificacion?temporada=${temporada}`);
            clasificacion = response.data;

            await redis.setex(key, 7200, JSON.stringify(clasificacion));
        } else {
            clasificacion = JSON.parse(clasificacion);
        }

        res.render('clasificacion', { clasificacion, temporada });
    } catch (error) {
        console.error('Error al obtener la clasificación:', error.message);
        res.status(500).send('Error al obtener la clasificación');
    }
});

app.get('/favoritos', async (req, res) => {
    try {
        const token = req.cookies.authToken;
        
        const response = await axios.get('http://flask:5000/favoritos', 
            {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
        
        const favoritos = response.data.favoritos;
        
        const equipos = [];
        
        let fav = true;

        for (let i = 0; i < favoritos.length; i++) {
            const equipoNombre = favoritos[i].Equipo;
            try {
                
                const equipoResponse = await axios.get(`http://servicio-datos:6000/api/equipos/${equipoNombre}`);

                if (equipoResponse.status === 200) {
                    equipos.push(equipoResponse.data);
                }
            } catch (error) {
                console.error(`No se pudo obtener el equipo: ${equipoNombre}`, error);
            }
        }

        res.render('home', {teams: equipos, fav});
    } catch (error) {
        console.error('Error al encontrar favoritos:', error);
        
        if (error.response) {
            res.status(error.response.status).json({
                message: error.response.data.message || 'Error desde el servicio Flask.',
                success: false
            });
        } else {
            res.status(500).json({
                message: 'Error interno del servidor.',
                success: false
            });
        }
    }
});

app.post('/registro', async (req, res) => {
    const { nombre, email, password } = req.body;

    try {
        const response = await axios.post('http://flask:5000/register', { nombre, email, password });
        
        console.log('Usuario registrado:', response.data);

        res.redirect('/');
    } catch (error) {

        if (error.response) {
            res.status(error.response.status).json({
                message: error.response.data.message || 'Error desde el servicio Flask.',
            });
        } else {
            res.render('registro', { mensaje: 'Ya existe un usuario con ese correo' });
        }
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const response = await axios.post('http://flask:5000/login', { email, password });
        
        const token = response.data.access_token

        res.cookie('authToken', token, {
            httpOnly: true,
            maxAge: 3600000,
        });

        res.redirect('/home');
    } catch (error) {

        if (error.response) {
            res.status(error.response.status).json({
                message: error.response.data.message || 'Error desde el servicio Flask.',
            });
        } else {
            res.render('login', { mensaje: 'Usuario o contraseña erroneos.' });
        }
    }
});

app.get('/addfavorito', async (req, res) => {
    const equipo = req.query.equipo;
    try {
        const token = req.cookies.authToken;
        
        const response = await axios.post('http://flask:5000/addfavorito', 
            {
                nombreEquipo: equipo
            }, 
            {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
        
        console.log(response.data);
    } catch (error) {
        console.error('Error al agregar favorito:', error);
        
        if (error.response) {
            res.status(error.response.status).json({
                message: error.response.data.message || 'Error desde el servicio Flask.',
                success: false
            });
        } else {
            res.status(500).json({
                message: 'Error interno del servidor.',
                success: false
            });
        }
    }
});

app.listen(process.env.PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${process.env.PORT}`);
    console.log(`Documentación disponible en http://localhost:${process.env.PORT}/api-docs`);
});