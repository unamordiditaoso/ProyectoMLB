const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    innings: {
        type: [Number],
        default: []
    },
    hits: {
        type: Number,
        default: 0
    },
    errors: {
        type: Number,
        default: 0
    }
}, { suppressReservedKeysWarning: true });

const partidoSchema = new mongoose.Schema({
    equipoLocal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Equipo',
        required: true
    },
    equipoVisitante: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Equipo',
        required: true
    },
    marcadorLocal: {
        type: Number,
        default: null
    },
    marcadorVisitante: {
        type: Number,
        default: null
    },
    temporada: {
        type: Number,
        required: true
    },
    ronda: {
        type: Number,
        default: null
    },
    fecha: {
        type: String,
        default: 'Fecha desconocida'
    },
    hora: {
        type: String,
        default: 'Hora desconocida'
    },
    estado: {
        type: String,
        default: 'NS'
    },
    resultado: {
        homeTeamResult: resultSchema,
        awayTeamResult: resultSchema
    }
});

module.exports = mongoose.model('Partido', partidoSchema);