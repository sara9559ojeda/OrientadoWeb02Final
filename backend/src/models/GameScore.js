import mongoose from 'mongoose';

const GameScoreSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'El usuario es requerido'],
      index: true, // Índice para búsquedas rápidas
    },
    totalPoints: {
      type: Number,
      required: [true, 'Los puntos totales son requeridos'],
      min: [0, 'Los puntos no pueden ser negativos'],
    },
    pointsByLevel: {
      level1: {
        type: Number,
        default: 0,
        min: [0, 'Los puntos del nivel 1 no pueden ser negativos'],
      },
      level2: {
        type: Number,
        default: 0,
        min: [0, 'Los puntos del nivel 2 no pueden ser negativos'],
      },
      level3: {
        type: Number,
        default: 0,
        min: [0, 'Los puntos del nivel 3 no pueden ser negativos'],
      },
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
    // Tiempo total de juego (opcional, en segundos)
    gameTime: {
      type: Number,
      min: [0, 'El tiempo de juego no puede ser negativo'],
    },
  },
  {
    timestamps: true,
  }
);

// Índice compuesto para búsquedas eficientes
GameScoreSchema.index({ user: 1, totalPoints: -1 });
GameScoreSchema.index({ totalPoints: -1 }); // Para rankings

// Método estático para obtener el mejor score de un usuario
GameScoreSchema.statics.getBestScore = async function (userId) {
  return await this.findOne({ user: userId })
    .sort({ totalPoints: -1 })
    .populate('user', 'email name')
    .exec();
};

// Método estático para obtener el ranking global
GameScoreSchema.statics.getRanking = async function (limit = 10) {
  return await this.find()
    .sort({ totalPoints: -1 })
    .limit(limit)
    .populate('user', 'email name')
    .exec();
};

export const GameScore = mongoose.model('GameScore', GameScoreSchema);

