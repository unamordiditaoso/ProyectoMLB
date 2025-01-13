const mongoose = require('mongoose');

const equipoSchema = new mongoose.Schema({
    nombre: String,
    abreviacion: String,
    estadio: String,
    capacidad: String,
    ubicacion: String,
    AnoCreacion: String,
    Logo: String,
});

module.exports = mongoose.model('Equipo', equipoSchema);