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
  // IS 10262 Table 1: X factor for target mean strength (Clause 4.2)
  targetStrengthFactor: {
    'M25': 5.5,
    'M30': 6.5, 'M35': 6.5, 'M40': 6.5, 'M45': 6.5, 'M50': 6.5, 'M55': 6.5, 'M60': 6.5,
    'M65': 8.0, 'M70': 8.0, 'M75': 8.0, 'M80': 8.0
  },
  // IS 456 Table 5: durability requirements differ by concrete type.
  exposureLimits: {
    reinforced: {
      mild: { minCement: 300, maxWc: 0.55, minGrade: 'M20' },
      moderate: { minCement: 300, maxWc: 0.50, minGrade: 'M25' },
      severe: { minCement: 320, maxWc: 0.45, minGrade: 'M30' },
      verySevere: { minCement: 340, maxWc: 0.45, minGrade: 'M35' },
      extreme: { minCement: 360, maxWc: 0.40, minGrade: 'M40' }
    },
    plain: {
      mild: { minCement: 220, maxWc: 0.60, minGrade: null },
      moderate: { minCement: 240, maxWc: 0.60, minGrade: 'M15' },
      severe: { minCement: 250, maxWc: 0.50, minGrade: 'M20' },
      verySevere: { minCement: 260, maxWc: 0.45, minGrade: 'M20' },
      extreme: { minCement: 280, maxWc: 0.40, minGrade: 'M25' }
    }
  },
  // IS 10262 Table 4: Water Content per Cubic Metre (Clause 5.3)
  // For nominal maximum size of aggregate
  waterContent: {
    10: 208,
    12.5: 202.5, // linearly interpolated between the 10 mm and 20 mm Table 4 values
    20: 186,
    40: 165
  },
  // IS 10262 Table 5: Volume of Coarse Aggregate per Unit Volume (Clause 5.5)
  // For W/C ratio 0.50, adjusted values per zone
  coarseAggregateVolume: {
    10: { 'zone1': 0.48, 'zone2': 0.50, 'zone3': 0.52, 'zone4': 0.54 },
    // Linearly interpolated at 12.5 mm between the 10 mm and 20 mm Table 5 values.
    12.5: { 'zone1': 0.51, 'zone2': 0.53, 'zone3': 0.55, 'zone4': 0.57 },
    20: { 'zone1': 0.60, 'zone2': 0.62, 'zone3': 0.64, 'zone4': 0.66 },
    40: { 'zone1': 0.69, 'zone2': 0.71, 'zone3': 0.72, 'zone4': 0.73 }
  },
  // Supplied Table 3. 12.5 mm is interpolated for the existing form option.
  airContent: {
    10: 1.5,
    12.5: 1.25,
    20: 1.0,
    40: 0.8
  },
  // Cement strength characteristics (28 days)
  cementStrength: { opc43: 43, opc53: 53, ppc: 33 },
  maxCementContent: 450,
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
 * Get assumed standard deviation per IS 10262:2019 Table 2.
 * Table 2 values apply to good site control. Table 2 Note 1 requires an
 * increase of 1 N/mm² where site control is fair.
 * @param {string} grade - Concrete grade (M20, M30, etc.)
 * @param {'good'|'fair'} siteControl - Degree of site control
 * @returns {number} Standard deviation (MPa)
 */
const getStandardDeviation = (grade, siteControl = 'good') => {
  const baseSD = STANDARDS.standardDeviation[grade] || 5.0;
  return baseSD + (siteControl === 'fair' ? 1.0 : 0.0);
};

const calculateMixDesign = async (inputData, userId) => {
  console.log('Calc inputData:', JSON.stringify(inputData, null, 2));
  const {
    grade = 'M30', cementType = 'OPC 43', maxAggregateSize = 20, exposureCondition = 'moderate', concreteType = 'reinforced',
    slump = 50, placingMethod = 'vibrated', pumpCaReductionPercent = 10, aggregateShape = 'angular', siteControl = 'good',
    faZone = 'zone2', spGravityCement = 3.15, spGravityFa = 2.6, spGravityCa = 2.7,
    needSuperplasticizer = false, superplasticizerPercentage = 0, specimenType = 'cube', specimenCount = 1,
    caWaterAbsorption = 0, faWaterAbsorption = 0, wastagePercentage = 3
  } = inputData;

  const normalizedCementType = normalizeCementType(cementType);
  const spGravity = { cement: spGravityCement, fa: spGravityFa, ca: spGravityCa };

  // Step 1: Target mean strength f_target = fck + t × s (IS 10262:2019 Clause 4.2.1.3)
  const fck_input = parseInt(grade.replace('M', ''), 10);
  const specimenFactor = STANDARDS.specimenFactors[specimenType] || 1.0;
  const fck_cube = specimenType === 'cube' ? fck_input : fck_input * specimenFactor;
  const actualSD = getStandardDeviation(grade, siteControl);
  const targetStrengthFactor = STANDARDS.targetStrengthFactor[grade] || 6.5;
  const targetByStandardDeviation = fck_cube + 1.65 * actualSD;
  const targetByFactor = fck_cube + targetStrengthFactor;
  const f_target_cube = Math.max(targetByStandardDeviation, targetByFactor);
  const f_target = specimenType === 'cube' ? f_target_cube : f_target_cube / specimenFactor;
  console.log(`Step 1: Target strength: ${f_target.toFixed(1)} MPa (${specimenType} input fck=${fck_input}, cube equivalent=${fck_cube}, S=${actualSD}, X=${targetStrengthFactor})`);

  // Step 2: Water/Cement ratio (IS 10262:2019 Clause 4.2.2)
  const wc_strength = getWcRatioFromStrength(f_target_cube, normalizedCementType);
  const exposureLimits = STANDARDS.exposureLimits[concreteType]?.[exposureCondition]
    || STANDARDS.exposureLimits.reinforced.moderate;
  const wc_durability = exposureLimits.maxWc;
  const wc_ratio = Math.min(wc_strength, wc_durability);
  console.log(`Step 2: w/c ratio: ${wc_ratio.toFixed(3)} (strength: ${wc_strength.toFixed(3)}, durability: ${wc_durability})`);

  // Step 3: Water content (IS 10262:2019 Table 4, Clause 5.3)
  const baseWaterContent = STANDARDS.waterContent[maxAggregateSize] || 186;
  const aggregateShapeWaterAdjustments = {
    angular: 0,
    subAngular: -10,
    partlyCrushedGravel: -15,
    roundedGravel: -20
  };
  const aggregateShapeWaterAdjustment = aggregateShapeWaterAdjustments[aggregateShape] ?? 0;
  let water_content = baseWaterContent + aggregateShapeWaterAdjustment;
  const slumpIncrease = Math.max(0, slump - 50);
  const slumpIncrement = Math.ceil(slumpIncrease / 25);
  const slumpAdjustmentPercent = slumpIncrement * 0.03;
  water_content *= 1 + slumpAdjustmentPercent;

  let superplasticizerReduction = 0;
  if (needSuperplasticizer && superplasticizerPercentage > 0) {
    superplasticizerReduction = Math.min(5, superplasticizerPercentage) * 8;
    water_content *= 1 - superplasticizerReduction / 100;
  }

  water_content = Math.max(140, water_content);
  console.log(`Step 3: Water content: ${water_content.toFixed(0)} kg/m³ (base: ${baseWaterContent}, shape: ${aggregateShapeWaterAdjustment}kg, slump adj: ${(slumpAdjustmentPercent * 100).toFixed(1)}%, SP reduction: ${superplasticizerReduction.toFixed(1)}%)`);

  const water_content_before_cement_adjustment = water_content;

  // Step 4: Cement content (IS 10262:2019 Clause 7.2)
  const cementLimits = { min: exposureLimits.minCement, max: STANDARDS.maxCementContent };
  const effectiveMinCement = cementLimits.min;
  let cement_content = water_content / wc_ratio;
  let cementFloored = false;
  let cementCapped = false;

  if (cement_content < effectiveMinCement) {
    cementFloored = true;
    cement_content = effectiveMinCement;
    water_content = cement_content * wc_ratio;
  }

  if (cement_content > cementLimits.max) {
    cementCapped = true;
    cement_content = cementLimits.max;
    water_content = cement_content * wc_ratio;
  }

  console.log(`Step 4: Cement: ${cement_content.toFixed(0)} kg/m³ (min: ${effectiveMinCement}, max: ${cementLimits.max})`);

  const cementCapWaterAdjustment = water_content_before_cement_adjustment - water_content;
  const cementAdjustmentNote = cementCapped
    ? `Cement content capped at ${cementLimits.max} kg/m³ per IS 456 Cl. 8.2.4.2; water content adjusted to ${water_content.toFixed(0)} kg/m³ to maintain w/c ratio of ${wc_ratio.toFixed(3)}.`
    : cementFloored
      ? `Cement content floored at ${effectiveMinCement} kg/m³ to meet the minimum cement-content requirement; water content adjusted to ${water_content.toFixed(0)} kg/m³ to maintain w/c ratio of ${wc_ratio.toFixed(3)}.`
      : null;

  // Step 5: Aggregate proportions using IS 10262:2019 Table 5 (Clause 5.5)
  let caVolumeRatio = STANDARDS.coarseAggregateVolume[maxAggregateSize]?.[faZone] || 0.62;
  // For every 0.05 below the 0.50 reference w/c ratio, increase CA by 0.01;
  // for every 0.05 above it, decrease CA by 0.01. Apply proportionally.
  const wcAdjustment = ((0.50 - wc_ratio) / 0.05) * 0.01;
  caVolumeRatio = Math.max(0.45, Math.min(0.75, caVolumeRatio + wcAdjustment));
  const caVolumeRatioBeforePumpReduction = caVolumeRatio;
  const appliedPumpCaReductionPercent = placingMethod === 'pump'
    ? Math.max(0, Math.min(10, Number(pumpCaReductionPercent)))
    : 0;
  caVolumeRatio *= 1 - appliedPumpCaReductionPercent / 100;

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

  // Step 6: Step 5 aggregate masses are SSD quantities. When aggregates are
  // batched oven-dry, derive their dry masses and the water required to reach
  // SSD. This added batch water does not change the effective design w/c ratio.
  const dryAggregateQuantities = {
    fa: fa_content / (1 + faWaterAbsorption / 100),
    ca: ca_content / (1 + caWaterAbsorption / 100)
  };
  const absorptionWater = {
    fa: fa_content - dryAggregateQuantities.fa,
    ca: ca_content - dryAggregateQuantities.ca
  };
  const totalAbsorptionWater = absorptionWater.fa + absorptionWater.ca;
  const wastageFactor = 1 + (wastagePercentage / 100);
  const baseMix = {
    cement: parseFloat(cement_content.toFixed(0)),
    water: parseFloat(water_content.toFixed(0)),
    fa: parseFloat(fa_content.toFixed(0)),
    ca: parseFloat(ca_content.toFixed(0)),
    w_c_ratio: parseFloat(wc_ratio.toFixed(3)),
    units: 'kg/m³'
  };
  const corrections = {
    effectiveWcRatio: wc_ratio,
    entrappedAirPercent: airPercent,
    airVolume: parseFloat(volumeOfAir.toFixed(4)),
    faWaterAbsorption,
    caWaterAbsorption,
    faAbsorptionWater: parseFloat(absorptionWater.fa.toFixed(1)),
    caAbsorptionWater: parseFloat(absorptionWater.ca.toFixed(1)),
    totalAbsorptionWater: parseFloat(totalAbsorptionWater.toFixed(1)),
    theoreticalMixBasis: '1 m³ design mix with aggregates in SSD condition',
    dryAggregateQuantities: {
      fa: parseFloat(dryAggregateQuantities.fa.toFixed(1)),
      ca: parseFloat(dryAggregateQuantities.ca.toFixed(1))
    },
    batchWater: {
      effectiveDesignWater: parseFloat(water_content.toFixed(1)),
      absorptionWater: parseFloat(totalAbsorptionWater.toFixed(1)),
      surfaceMoistureWater: 0,
      actualBatchWater: parseFloat((water_content + totalAbsorptionWater).toFixed(1))
    },
    wastagePercentage,
    wastage: {
      cement: parseFloat((cement_content * (wastageFactor - 1)).toFixed(1)),
      fa: parseFloat((fa_content * (wastageFactor - 1)).toFixed(1)),
      ca: parseFloat((ca_content * (wastageFactor - 1)).toFixed(1))
    },
    procurementQuantities: {
      cement: parseFloat((cement_content * wastageFactor).toFixed(1)),
      faSSD: parseFloat((fa_content * wastageFactor).toFixed(1)),
      caSSD: parseFloat((ca_content * wastageFactor).toFixed(1)),
      faDry: parseFloat((dryAggregateQuantities.fa * wastageFactor).toFixed(1)),
      caDry: parseFloat((dryAggregateQuantities.ca * wastageFactor).toFixed(1))
    },
    exposure: { concreteType, ...exposureLimits },
    warnings: [
      ...(caWaterAbsorption > 2 ? ['Coarse aggregate water absorption exceeds the recommended 2% limit.'] : []),
      ...(faWaterAbsorption > 3 ? ['Fine aggregate water absorption exceeds the recommended 3% limit.'] : [])
    ]
  };
  const finalMix = {
    cement: parseFloat((cement_content * wastageFactor).toFixed(0)),
    water: parseFloat((water_content + totalAbsorptionWater).toFixed(0)),
    fa: parseFloat((fa_content * wastageFactor).toFixed(0)),
    ca: parseFloat((ca_content * wastageFactor).toFixed(0)),
    w_c_ratio: parseFloat(wc_ratio.toFixed(3)),
    units: 'kg/m³'
  };
  console.log(`Step 6: Dry aggregate absorption water: ${totalAbsorptionWater.toFixed(1)} kg/m³, wastage: ${wastagePercentage}%`);

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
    { step: 1, targetStrength: f_target.toFixed(1), standardDeviation: actualSD.toFixed(1), targetByStandardDeviation: targetByStandardDeviation.toFixed(1), targetByFactor: targetByFactor.toFixed(1), targetStrengthFactor: targetStrengthFactor.toFixed(1), siteControl, inputFck: fck_input, specimenType, specimenCount },
    { step: 2, wcRatio: wc_ratio.toFixed(3), wcStrength: wc_strength.toFixed(3), wcDurability: wc_durability.toFixed(3) },
    { step: 3, waterContent: water_content_before_cement_adjustment.toFixed(0), baseWater: baseWaterContent, aggregateShape, aggregateShapeWaterAdjustment, slumpAdjustment: (slumpAdjustmentPercent * 100).toFixed(1), superplasticizerReduction: superplasticizerReduction.toFixed(0) },
    { step: 4, cementContent: cement_content.toFixed(0), cementLimits: `${cementLimits.min}-${cementLimits.max}`, minGrade: exposureLimits.minGrade || 'None', concreteType, cementCapped, cementFloored, cementCapWaterAdjustment: parseFloat(cementCapWaterAdjustment.toFixed(1)), note: cementAdjustmentNote },
    { step: 5, caVolumeRatio: caVolumeRatio.toFixed(3), caVolumeRatioBeforePumpReduction: caVolumeRatioBeforePumpReduction.toFixed(3), pumpCaReductionPercent: appliedPumpCaReductionPercent, airContent: airPercent.toFixed(2), airVolume: volumeOfAir.toFixed(4), caContent: ca_content.toFixed(0), faContent: fa_content.toFixed(0) },
    { step: 6, moistureCorrections: { additionalWater: totalAbsorptionWater.toFixed(1), faAbsorption: faWaterAbsorption, caAbsorption: caWaterAbsorption, faAbsorptionWater: absorptionWater.fa.toFixed(1), caAbsorptionWater: absorptionWater.ca.toFixed(1), wastagePercentage } }
  ];

  // Save to DB
  const dbInput = JSON.parse(JSON.stringify(inputData));
  const mix = new MixDesign({ userId, inputData: dbInput, resultData: { steps, baseMix, corrections, finalMix, specimenResult } });
  await mix.save();
  console.log('Saved mix ID:', mix._id);

  return { steps, baseMix, corrections, finalMix, specimenResult, id: mix._id };
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
  if (input.concreteType && !['reinforced', 'plain'].includes(input.concreteType)) {
    errors.push('Concrete type must be reinforced or plain');
  }
  const concreteType = input.concreteType || 'reinforced';
  const exposureLimit = STANDARDS.exposureLimits[concreteType]?.[input.exposureCondition];
  const gradeNumber = Number(String(input.grade || '').replace('M', ''));
  if (exposureLimit?.minGrade && gradeNumber < Number(exposureLimit.minGrade.replace('M', ''))) {
    errors.push(`${input.exposureCondition} exposure requires at least ${exposureLimit.minGrade} grade for ${concreteType} concrete`);
  }
  if (input.caWaterAbsorption != null && (input.caWaterAbsorption < 0 || input.caWaterAbsorption > 100)) {
    errors.push('Coarse aggregate water absorption must be between 0 and 100%');
  }
  if (input.faWaterAbsorption != null && (input.faWaterAbsorption < 0 || input.faWaterAbsorption > 100)) {
    errors.push('Fine aggregate water absorption must be between 0 and 100%');
  }
  if (input.wastagePercentage != null && (input.wastagePercentage < 0 || input.wastagePercentage > 100)) {
    errors.push('Wastage must be between 0 and 100%');
  }
  if (input.specimenType && !['cube','prism','cylinder'].includes(input.specimenType)) {
    errors.push('Invalid specimen type (cube, prism, cylinder)');
  }
  if (input.specimenCount == null || input.specimenCount < 1 || input.specimenCount > 100) {
    errors.push('Number of specimens must be between 1 and 100');
  }
  if (input.siteControl && !['good', 'fair'].includes(input.siteControl)) {
    errors.push('Site control must be good or fair');
  }
  if (input.aggregateShape && !['angular', 'subAngular', 'partlyCrushedGravel', 'roundedGravel'].includes(input.aggregateShape)) {
    errors.push('Invalid aggregate shape');
  }
  if (input.pumpCaReductionPercent != null && (input.pumpCaReductionPercent < 0 || input.pumpCaReductionPercent > 10)) {
    errors.push('Pump coarse aggregate reduction must be between 0 and 10%');
  }
  if (input.needSuperplasticizer && (input.superplasticizerPercentage < 0 || input.superplasticizerPercentage > 5)) {
    errors.push('Superplasticizer percentage must be 0-5%');
  }
  if (input.spGravityCement && (input.spGravityCement < 2.0 || input.spGravityCement > 3.2)) {
    errors.push('Cement specific gravity must be 2.0-3.2');
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