const mongoose = require('mongoose');

const mixDesignSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  inputData: {
    grade: { type: String, required: true },
    cementType: String,
    maxAggregateSize: Number,
    exposureCondition: String,
    minCementContent: Number,
    slump: Number,
    placingMethod: String,
    standardDeviation: Number,
    caType: String,
    faZone: String,
    spGravityCement: Number,
    spGravityFa: Number,
    spGravityCa: Number,
    mineralAdmixtureType: String,
    waterCementRatio: Number,
    specimenType: { type: String, default: 'cube' },
    specimenCount: { type: Number, default: 1 }
  },
  resultData: {
    steps: [mongoose.Mixed],
    finalMix: {
      cement: Number,
      water: Number,
      fa: Number,
      ca: Number,
      w_c_ratio: Number
    },
    specimenResult: {
      specimenType: String,
      specimenCount: Number,
      targetStrength: Number,
      equivalentCubeStrength: Number,
      specimenVolume: Number,
      perSpecimenMix: {
        volume_m3: Number,
        cement: Number,
        water: Number,
        fa: Number,
        ca: Number,
        units: String
      },
      totalSpecimenMix: {
        volume_m3: Number,
        cement: Number,
        water: Number,
        fa: Number,
        ca: Number,
        units: String
      }
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('MixDesign', mixDesignSchema);

