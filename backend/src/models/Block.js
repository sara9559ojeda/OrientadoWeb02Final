import mongoose from 'mongoose';

const blockSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    x: {
      type: Number,
      required: true,
    },
    y: {
      type: Number,
      required: true,
    },
    z: {
      type: Number,
      required: true,
    },
    Role: {
      type: String,
      required: true,
      enum: ['vehicle', 'building', 'default', 'finalPrize'],
      index: true,
    },
    level: {
      type: Number,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para búsquedas rápidas
blockSchema.index({ level: 1, Role: 1 });
blockSchema.index({ name: 1 });

const Block = mongoose.model('Block', blockSchema);

export { Block };

