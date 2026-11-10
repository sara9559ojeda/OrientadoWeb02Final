import mongoose from 'mongoose';

// Niveles que se puntúan por separado
export const SCORED_LEVELS = [1, 2, 3, 4, 5];

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
    // Desglose de puntos por nivel (level1 … level5)
    pointsByLevel: Object.fromEntries(
      SCORED_LEVELS.map((n) => [
        `level${n}`,
        {
          type: Number,
          default: 0,
          min: [0, `Los puntos del nivel ${n} no pueden ser negativos`],
        },
      ])
    ),
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

