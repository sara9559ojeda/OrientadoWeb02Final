import mongoose from 'mongoose';

const LevelSchema = new mongoose.Schema(
  {
    levelNumber: {
      type: Number,
      required: [true, 'El número de nivel es requerido'],
      unique: true, // unique: true ya crea un índice automáticamente
      min: [1, 'El nivel debe ser al menos 1'],
      max: [10, 'El nivel no puede ser mayor a 10'],
    },
    coinsCount: {
      type: Number,
      required: [true, 'La cantidad de coins es requerida'],
      min: [1, 'Debe haber al menos 1 coin'],
      default: 10,
    },
    enemiesCount: {
      type: Number,
      required: [true, 'La cantidad de enemigos es requerida'],
      min: [0, 'No puede haber enemigos negativos'],
      default: 1,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// No necesitamos crear el índice manualmente porque unique: true ya lo crea
// LevelSchema.index({ levelNumber: 1 }); // REMOVIDO - duplicado

export const Level = mongoose.model('Level', LevelSchema);

