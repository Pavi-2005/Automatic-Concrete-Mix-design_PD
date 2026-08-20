const MixDesign = require('../models/MixDesign');

// IS 10262:2019 Standards Tables
const STANDARDS = {
  // IS 10262 Table 2: Assumed Standard Deviation (Clause 4.2.1.3)
  // Values for 30+ test results, adjusted based on test count
  standardDeviation: {
    'M25': 4.0,
    'M30': 5.0, 'M35': 5.0, 'M40': 5.0, 'M45': 5.0, 'M50': 5.0, 'M55': 5.0, 'M60': 5.0,
    'M65': 6.0, 'M70': 6.0, 'M75': 6.0, 'M80': 6.0
  },
  // IS456 Table 5: Max w/c for durability (exposure condition)
  maxWcDurability: {
    mild: 0.55,
    moderate: 0.50,
    severe: 0.45,
    verySevere: 0.40,
    extreme: 0.35
  },
  // IS 10262 Table 4: Water Content per Cubic Metre (Clause 5.3)
  // For nominal maximum size of aggregate
  waterContent: {
    10: 208,
    12.5: 197, // interpolated between 10 and 20
    20: 186,
    40: 165
  },
  // IS 10262 Table 5: Volume of Coarse Aggregate per Unit Volume (Clause 5.5)
  // For W/C ratio 0.50, adjusted values per zone
  coarseAggregateVolume: {
    10: { 'zone1': 0.48, 'zone2': 0.50, 'zone3': 0.52, 'zone4': 0.54 },
    12.5: { 'zone1': 0.55, 'zone2': 0.57, 'zone3': 0.59, 'zone4': 0.61 },
    20: { 'zone1': 0.60, 'zone2': 0.62, 'zone3': 0.64, 'zone4': 0.66 },
    40: { 'zone1': 0.69, 'zone2': 0.71, 'zone3': 0.72, 'zone4': 0.73 }
  },
  // IS 10262 Table 6: Approximate Air Content (Clause 6.2.3)
  airContent: {
    10: 1.0,
    12.5: 0.8,
    20: 0.5,
    40: 0.4
  },
  // Cement strength characteristics (28 days)
  cementStrength: { opc43: 43, opc53: 53, ppc: 33 },
  // Min/Max cement content per IS 10262 Cl 7.2 (kg/m³)
  cementLimits: {
    mild: { min: 300, max: 450 },
    moderate: { min: 320, max: 450 },
    severe: { min: 340, max: 450 },
    verySevere: { min: 360, max: 450 },
    extreme: { min: 380, max: 450 }
  },
  // Specimen size conversion factors (cube strength = factor * cylinder/prism strength)
  specimenFactors: {
    cube: 1.0,      // Reference
    cylinder: 1.25, // Cube = 1.25 * Cylinder
    prism: 1.20     // Approximate for 100x100x500mm
  },
  unitWtConcrete: 2400 // kg/m3 approx for vol calcs
};

const getSpecimenVolume = (specimenType) => {
  switch (specimenType) {
    case 'cube':
      return 0.150 * 0.150 * 0.150; // 150 x 150 x 150 mm
    case 'prism':
      return 0.100 * 0.100 * 0.500; // 100 x 100 x 500 mm
    case 'cylinder':
      return Math.PI * 0.075 * 0.075 * 0.300; // 150 mm dia x 300 mm height
    default:
      return 0.150 * 0.150 * 0.150;
  }
};

// Helper function to normalize cement type
const normalizeCementType = (cementType) => {
  const mapping = {
    'OPC 43': 'opc43',
    'OPC 53': 'opc53',
    'PPC': 'ppc'
  };
  return mapping[cementType] || cementType;
};

/**
 * Calculate water-cement ratio from target strength per IS 10262:2019 Clause 4.2.2
 * @param {number} f_target - Target mean strength (MPa)
 * @param {string} cementType - Type of cement (opc43, opc53, ppc)
 * @returns {number} Water-cement ratio
 */
const interpolateWcRatio = (targetStrength, table) => {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  if (targetStrength <= keys[0]) return table[keys[0]];
  if (targetStrength >= keys[keys.length - 1]) return table[keys[keys.length - 1]];

  for (let i = 0; i < keys.length - 1; i += 1) {
    const low = keys[i];
    const high = keys[i + 1];
    if (targetStrength === low) return table[low];
    if (targetStrength < high) {
      const ratioLow = table[low];
      const ratioHigh = table[high];
      const fraction = (targetStrength - low) / (high - low);
      return ratioLow + (ratioHigh - ratioLow) * fraction;
    }
  }

  return table[keys[keys.length - 1]];
};

const getWcRatioFromStrength = (f_target, cementType) => {
  const wcTables = {
    opc43: {
      22: 0.55, 25: 0.50, 30: 0.46, 35: 0.44,
      40: 0.42, 45: 0.40, 50: 0.38, 55: 0.37,
      60: 0.36, 65: 0.35, 70: 0.34, 75: 0.33,
      80: 0.32
    },
    opc53: {
      22: 0.50, 25: 0.47, 30: 0.44, 35: 0.42,
      40: 0.40, 45: 0.38, 50: 0.36, 55: 0.34,
      60: 0.32, 65: 0.31, 70: 0.30, 75: 0.29,
      80: 0.28
    },
    ppc: {
      22: 0.60, 25: 0.55, 30: 0.52, 35: 0.49,
      40: 0.46, 45: 0.44, 50: 0.42, 55: 0.40,
      60: 0.39, 65: 0.38, 70: 0.37, 75: 0.36,
      80: 0.35
    }
  };

  const table = wcTables[cementType] || wcTables.opc43;
  const wc = interpolateWcRatio(f_target, table);
  return Math.max(0.30, Math.min(0.65, wc));
};

/**
 * Get standard deviation based on number of test results per IS 10262:2019 Table 2
 * @param {string} grade - Concrete grade (M20, M30, etc.)
 * @param {number} testResultsCount - Number of test results available
 * @returns {number} Standard deviation (MPa)
 */
const getTFactor = (testResultsCount = 30) => {
  if (testResultsCount >= 30) return 1.65;
  if (testResultsCount >= 10) return 1.80;
  return 1.96;
};

const getStandardDeviation = (grade, testResultsCount = 30) => {
  const baseSD = STANDARDS.standardDeviation[grade] || 5.0;
  return baseSD + (testResultsCount >= 30 ? 0.0 : testResultsCount >= 10 ? 1.0 : 2.0);
};

/**
 * Apply moisture corrections per IS 10262:2019 Clause 5.6
 * @param {object} aggregates - Aggregate weights {fa: number, ca: number} in SSD condition
 * @param {object} moisture - Surface moisture content {fa: number, ca: number} (%)
 * @param {object} absorption - Water absorption {fa: number, ca: number} (%)
 * @returns {object} Corrected values {waterAdjustment: number, correctedAggregates: object}
 */
const applyMoistureCorrections = (aggregates, moisture, absorption) => {
  const correctAggregate = (ssdMass, surfaceMoisture, absorptionWater) => {
    const actualMass = ssdMass * (1 + (surfaceMoisture - absorptionWater) / 100);
    const waterAdjustment = ssdMass * ((absorptionWater - surfaceMoisture) / 100);
    return { actualMass, waterAdjustment };
  };

  const faCorrection = correctAggregate(aggregates.fa, moisture.fa, absorption.fa);
  const caCorrection = correctAggregate(aggregates.ca, moisture.ca, absorption.ca);

  return {
    waterAdjustment: faCorrection.waterAdjustment + caCorrection.waterAdjustment,
    correctedAggregates: {
      fa: faCorrection.actualMass,
      ca: caCorrection.actualMass
    }
  };
};

const calculateMixDesign = async (inputData, userId) => {
  console.log('Calc inputData:', JSON.stringify(inputData, null, 2));
  const {
    grade = 'M30', cementType = 'OPC 43', maxAggregateSize = 20, exposureCondition = 'moderate',
    minCementContent = 0, slump = 50, placingMethod = 'vibrated', standardDeviation = null,
    faZone = 'zone2', spGravityCement = 3.15, spGravityFa = 2.6, spGravityCa = 2.7,
    mineralAdmixtureType = '', waterCementRatio = null, testResultsCount = 30,
    needSuperplasticizer = false, superplasticizerPercentage = 0, specimenType = 'cube', specimenCount = 1
  } = inputData;

  const normalizedCementType = normalizeCementType(cementType);
  const spGravity = { cement: spGravityCement, fa: spGravityFa, ca: spGravityCa };

  // Step 1: Target mean strength f_target = fck + t × s (IS 10262:2019 Clause 4.2.1.3)
  const fck_input = parseInt(grade.replace('M', ''), 10);
  const specimenFactor = STANDARDS.specimenFactors[specimenType] || 1.0;
  const fck_cube = specimenType === 'cube' ? fck_input : fck_input * specimenFactor;
  const actualSD = standardDeviation || getStandardDeviation(grade, testResultsCount);
  const tFactor = getTFactor(testResultsCount);
  const f_target_cube = fck_cube + tFactor * actualSD;
  const f_target = specimenType === 'cube' ? f_target_cube : f_target_cube / specimenFactor;
  console.log(`Step 1: Target strength: ${f_target.toFixed(1)} MPa (${specimenType} input fck=${fck_input}, cube equivalent=${fck_cube}, SD=${actualSD}, t=${tFactor})`);

  // Step 2: Water/Cement ratio (IS 10262:2019 Clause 4.2.2)
  const wc_strength = getWcRatioFromStrength(f_target_cube, normalizedCementType);
  const wc_durability = STANDARDS.maxWcDurability[exposureCondition] || 0.50;
  const wc_ratio = Math.min(wc_strength, wc_durability);
  console.log(`Step 2: w/c ratio: ${wc_ratio.toFixed(3)} (strength: ${wc_strength.toFixed(3)}, durability: ${wc_durability})`);

  // Step 3: Water content (IS 10262:2019 Table 4, Clause 5.3)
  let water_content = STANDARDS.waterContent[maxAggregateSize] || 186;
  const slumpIncrease = Math.max(0, slump - 50);
  const slumpIncrement = Math.ceil(slumpIncrease / 25);
  const slumpAdjustmentPercent = slumpIncrement * 0.03;
  water_content *= 1 + slumpAdjustmentPercent;

  if (placingMethod === 'pump') {
    water_content += 10;
  }

  let superplasticizerReduction = 0;
  if (needSuperplasticizer && superplasticizerPercentage > 0) {
    superplasticizerReduction = Math.min(5, superplasticizerPercentage) * 8;
    water_content *= 1 - superplasticizerReduction / 100;
  }

  water_content = Math.max(140, water_content);
  console.log(`Step 3: Water content: ${water_content.toFixed(0)} kg/m³ (base: ${STANDARDS.waterContent[maxAggregateSize]}, slump adj: ${(slumpAdjustmentPercent * 100).toFixed(1)}%, pump: ${placingMethod === 'pump' ? 10 : 0}kg, SP reduction: ${superplasticizerReduction.toFixed(1)}%)`);

  // Step 4: Cement content (IS 10262:2019 Clause 7.2)
  const cementLimits = STANDARDS.cementLimits[exposureCondition] || { min: 300, max: 450 };
  const effectiveMinCement = Math.max(minCementContent || 0, cementLimits.min);
  let cement_content = water_content / wc_ratio;

  if (cement_content < effectiveMinCement) {
    cement_content = effectiveMinCement;
    water_content = cement_content * wc_ratio;
  }

  if (cement_content > cementLimits.max) {
    cement_content = cementLimits.max;
    water_content = cement_content * wc_ratio;
  }

  console.log(`Step 4: Cement: ${cement_content.toFixed(0)} kg/m³ (min: ${effectiveMinCement}, max: ${cementLimits.max})`);

  // Step 5: Aggregate proportions using IS 10262:2019 Table 5 (Clause 5.5)
  let caVolumeRatio = STANDARDS.coarseAggregateVolume[maxAggregateSize]?.[faZone] || 0.62;
  const wcAdjustment = (0.5 - wc_ratio) / 0.05;
  caVolumeRatio = Math.max(0.45, Math.min(0.75, caVolumeRatio - wcAdjustment * 0.01));

  const airPercent = STANDARDS.airContent[maxAggregateSize] || 0.5;
  const volumeOfAir = airPercent / 100;
  const volumeOfWater = water_content / 1000;
  const volumeOfCement = cement_content / (spGravity.cement * 1000);
  let volumeOfAggregates = 1 - volumeOfAir - volumeOfWater - volumeOfCement;
  if (volumeOfAggregates < 0.05) {
    volumeOfAggregates = 0.05;
  }

  const volumeCA = volumeOfAggregates * caVolumeRatio;
  const volumeFA = volumeOfAggregates * (1 - caVolumeRatio);
  const ca_content = volumeCA * spGravityCa * 1000;
  const fa_content = volumeFA * spGravityFa * 1000;

  console.log(`Step 5: CA ratio: ${caVolumeRatio.toFixed(3)}, Air: ${airPercent}%, CA: ${ca_content.toFixed(0)}, FA: ${fa_content.toFixed(0)} kg/m³`);

  // Step 6: Moisture corrections (IS 10262:2019 Clause 5.6)
  const moistureContent = { fa: 2.0, ca: 1.5 };
  const waterAbsorption = { fa: 1.0, ca: 0.5 };
  const corrections = applyMoistureCorrections({ fa: fa_content, ca: ca_content }, moistureContent, waterAbsorption);

  water_content += corrections.waterAdjustment;
  const fa_final = corrections.correctedAggregates.fa;
  const ca_final = corrections.correctedAggregates.ca;

  console.log(`Step 6: Moisture corrections - water adjustment: ${corrections.waterAdjustment.toFixed(1)} kg/m³`);

  const finalCement = Math.max(effectiveMinCement, Math.min(cementLimits.max, water_content / wc_ratio));

  const finalMix = {
    cement: parseFloat(finalCement.toFixed(0)),
    water: parseFloat(water_content.toFixed(0)),
    fa: parseFloat(fa_final.toFixed(0)),
    ca: parseFloat(ca_final.toFixed(0)),
    w_c_ratio: parseFloat(wc_ratio.toFixed(3)),
    units: 'kg/m³'
  };

  const specimenVolume = getSpecimenVolume(specimenType);
  const perSpecimenMix = {
    volume_m3: parseFloat(specimenVolume.toFixed(6)),
    cement: parseFloat((finalMix.cement * specimenVolume).toFixed(2)),
    water: parseFloat((finalMix.water * specimenVolume).toFixed(2)),
    fa: parseFloat((finalMix.fa * specimenVolume).toFixed(2)),
    ca: parseFloat((finalMix.ca * specimenVolume).toFixed(2)),
    units: 'kg/specimen'
  };
  const totalSpecimenMix = {
    volume_m3: parseFloat((specimenVolume * specimenCount).toFixed(6)),
    cement: parseFloat((perSpecimenMix.cement * specimenCount).toFixed(2)),
    water: parseFloat((perSpecimenMix.water * specimenCount).toFixed(2)),
    fa: parseFloat((perSpecimenMix.fa * specimenCount).toFixed(2)),
    ca: parseFloat((perSpecimenMix.ca * specimenCount).toFixed(2)),
    units: `kg/${specimenCount} specimen${specimenCount === 1 ? '' : 's'}`
  };

  const specimenResult = {
    specimenType,
    specimenCount,
    targetStrength: parseFloat(f_target.toFixed(1)),
    equivalentCubeStrength: parseFloat(f_target_cube.toFixed(1)),
    specimenVolume: parseFloat(specimenVolume.toFixed(6)),
    perSpecimenMix,
    totalSpecimenMix
  };

  const steps = [
    { step: 1, targetStrength: f_target.toFixed(1), standardDeviation: actualSD.toFixed(1), inputFck: fck_input, specimenType, specimenCount },
    { step: 2, wcRatio: wc_ratio.toFixed(3), wcStrength: wc_strength.toFixed(3), wcDurability: wc_durability.toFixed(3) },
    { step: 3, waterContent: water_content.toFixed(0), baseWater: STANDARDS.waterContent[maxAggregateSize], slumpAdjustment: (slumpAdjustmentPercent * 100).toFixed(1), superplasticizerReduction: superplasticizerReduction.toFixed(0) },
    { step: 4, cementContent: finalCement.toFixed(0), cementLimits: `${cementLimits.min}-${cementLimits.max}` },
    { step: 5, caVolumeRatio: caVolumeRatio.toFixed(3), airContent: airPercent.toFixed(1), caContent: ca_final.toFixed(0), faContent: fa_final.toFixed(0) },
    { step: 6, moistureCorrections: { additionalWater: corrections.waterAdjustment.toFixed(1), faAbsorption: waterAbsorption.fa, caAbsorption: waterAbsorption.ca } }
  ];

  // Save to DB
  const dbInput = JSON.parse(JSON.stringify(inputData));
  const mix = new MixDesign({ userId, inputData: dbInput, resultData: { steps, finalMix, specimenResult } });
  await mix.save();
  console.log('Saved mix ID:', mix._id);

  return { steps, finalMix, specimenResult, id: mix._id };
};

const validateInputs = (input) => {
  console.log('Validation input:', input);
  const errors = [];
  const validGrades = ['M25', 'M30', 'M35', 'M40', 'M45', 'M50', 'M55', 'M60', 'M65', 'M70', 'M75', 'M80'];
  if (!input.grade || !validGrades.includes(input.grade)) {
    errors.push('Invalid grade (M25-M80)');
  }
  if (!input.slump || input.slump < 25 || input.slump > 150) {
    errors.push('Slump must be 25-150mm');
  }
  if (!input.maxAggregateSize || ![10,12.5,20,40].includes(Number(input.maxAggregateSize))) {
    errors.push('Invalid aggregate size (10, 12.5, 20, 40 mm)');
  }
  if (!input.exposureCondition || !['mild','moderate','severe','verySevere','extreme'].includes(input.exposureCondition)) {
    errors.push('Invalid exposure condition');
  }
  if (!input.faZone || !['zone1','zone2','zone3','zone4'].includes(input.faZone)) {
    errors.push('Invalid fine aggregate zone (zone1-zone4)');
  }
  if (!input.cementType || !['OPC 43','OPC 53','PPC'].includes(input.cementType)) {
    errors.push('Invalid cement type (OPC 43, OPC 53, PPC)');
  }
  if (input.specimenType && !['cube','prism','cylinder'].includes(input.specimenType)) {
    errors.push('Invalid specimen type (cube, prism, cylinder)');
  }
  if (input.specimenCount == null || input.specimenCount < 1 || input.specimenCount > 100) {
    errors.push('Number of specimens must be between 1 and 100');
  }
  if (input.standardDeviation == null || input.standardDeviation < 1 || input.standardDeviation > 10) {
    errors.push('Standard deviation must be between 1 and 10');
  }
  if (input.needSuperplasticizer && (input.superplasticizerPercentage < 0 || input.superplasticizerPercentage > 5)) {
    errors.push('Superplasticizer percentage must be 0-5%');
  }
  if (input.testResultsCount && (input.testResultsCount < 1 || input.testResultsCount > 100)) {
    errors.push('Test results count must be 1-100');
  }
  if (input.spGravityCement && (input.spGravityCement < 3.0 || input.spGravityCement > 3.2)) {
    errors.push('Cement specific gravity must be 3.0-3.2');
  }
  if (input.spGravityFa && (input.spGravityFa < 2.5 || input.spGravityFa > 2.8)) {
    errors.push('Fine aggregate specific gravity must be 2.5-2.8');
  }
  if (input.spGravityCa && (input.spGravityCa < 2.5 || input.spGravityCa > 3.0)) {
    errors.push('Coarse aggregate specific gravity must be 2.5-3.0');
  }
  return errors;
};

module.exports = { calculateMixDesign, validateInputs };

