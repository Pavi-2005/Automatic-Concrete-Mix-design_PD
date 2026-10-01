jest.mock('../models/MixDesign', () => jest.fn().mockImplementation(function MockMixDesign(data) {
  Object.assign(this, data);
  this._id = 'test-mix-id';
  this.save = jest.fn().mockResolvedValue(this);
}));

const { calculateMixDesign } = require('../services/mixDesignService');

const commonInput = {
  cementType: 'OPC 43',
  maxAggregateSize: 20,
  exposureCondition: 'moderate',
  concreteType: 'reinforced',
  slump: 50,
  placingMethod: 'vibrated',
  siteControl: 'good',
  faZone: 'zone2',
  spGravityCement: 3.15,
  spGravityFa: 2.6,
  spGravityCa: 2.7,
  needSuperplasticizer: false,
  superplasticizerPercentage: 0,
  specimenType: 'cube',
  specimenCount: 1,
  caWaterAbsorption: 0,
  faWaterAbsorption: 0,
  wastagePercentage: 0
};

const design = (overrides) => calculateMixDesign({ ...commonInput, ...overrides }, 'test-user');

const publishedBaseVolume = (result) => {
  const { cement, water, fa, ca } = result.baseMix;
  return 0.01 + water / 1000 + cement / 3150 + fa / 2600 + ca / 2700;
};

describe('IS 10262 target-strength and mix-design regression cases', () => {
  beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  test('M25 uses max(fck + 1.65S, fck + X) and has the expected base mix', async () => {
    const result = await design({ grade: 'M25' });

    expect(result.steps[0]).toMatchObject({
      targetStrength: '31.6',
      standardDeviation: '4.0',
      targetByStandardDeviation: '31.6',
      targetByFactor: '30.5',
      targetStrengthFactor: '5.5',
      siteControl: 'good'
    });
    expect(result.baseMix).toMatchObject({ cement: 410, water: 186, fa: 649, ca: 1145, w_c_ratio: 0.454 });
  });

  test('M30 has the expected target strength, w/c and base mix', async () => {
    const result = await design({ grade: 'M30' });

    expect(result.steps[0]).toMatchObject({ targetStrength: '38.3', targetByStandardDeviation: '38.3', targetByFactor: '36.5' });
    expect(result.steps[1]).toMatchObject({ wcStrength: '0.427', wcDurability: '0.500', wcRatio: '0.427' });
    expect(result.baseMix).toMatchObject({ cement: 436, water: 186, fa: 632, ca: 1141, w_c_ratio: 0.427 });
  });

  test('M60 strength governs and the 450 kg/m³ cement cap preserves selected w/c', async () => {
    const result = await design({ grade: 'M60' });

    expect(result.steps[0]).toMatchObject({ targetStrength: '68.3', targetByStandardDeviation: '68.3', targetByFactor: '66.5' });
    expect(result.steps[1]).toMatchObject({ wcStrength: '0.344', wcDurability: '0.500', wcRatio: '0.344' });
    expect(result.steps[3]).toMatchObject({ cementCapped: true, cementContent: '450' });
    expect(result.baseMix).toMatchObject({ cement: 450, water: 155, fa: 628, ca: 1218, w_c_ratio: 0.344 });
    expect(154.575 / 450).toBeCloseTo(result.corrections.effectiveWcRatio, 10);
  });

  test('published rounded base mix closes within 0.001 m³', async () => {
    const result = await design({ grade: 'M30' });

    expect(Math.abs(publishedBaseVolume(result) - 1)).toBeLessThanOrEqual(0.001);
  });

  test('durability governs when the strength curve allows a higher w/c', async () => {
    const result = await design({ grade: 'M25', cementType: 'PPC' });

    expect(result.steps[1]).toMatchObject({ wcStrength: '0.510', wcDurability: '0.500', wcRatio: '0.500' });
  });

  test('fair site control increases Table 2 assumed S by exactly 1 N/mm²', async () => {
    const result = await design({ grade: 'M25', siteControl: 'fair' });

    expect(result.steps[0]).toMatchObject({ standardDeviation: '5.0', targetStrength: '33.3', siteControl: 'fair' });
  });

  test('pump placement applies selected CA reduction and does not add fixed water', async () => {
    const result = await design({ grade: 'M30', placingMethod: 'pump', pumpCaReductionPercent: 10 });

    expect(result.steps[3]).toMatchObject({ cementCapped: false });
    expect(result.steps[4]).toMatchObject({
      caVolumeRatioBeforePumpReduction: '0.635',
      caVolumeRatio: '0.571',
      pumpCaReductionPercent: 10,
      caContent: '1027',
      faContent: '742'
    });
    expect(result.baseMix).toMatchObject({ water: 186, cement: 436, ca: 1027, fa: 742 });
  });

  test('rounded gravel reduces Table 4 angular-baseline water by 20 kg/m³', async () => {
    const result = await design({ grade: 'M30', aggregateShape: 'roundedGravel' });

    expect(result.steps[2]).toMatchObject({
      baseWater: 186,
      aggregateShape: 'roundedGravel',
      aggregateShapeWaterAdjustment: -20,
      waterContent: '166'
    });
    expect(result.baseMix).toMatchObject({ water: 166, cement: 389, ca: 1200, fa: 666, w_c_ratio: 0.427 });
  });

  test.each([
    ['subAngular', -10, '176'],
    ['partlyCrushedGravel', -15, '171'],
    ['roundedGravel', -20, '166']
  ])('aggregate shape %s applies the Clause 5.3 water allowance', async (aggregateShape, adjustment, waterContent) => {
    const result = await design({ grade: 'M30', aggregateShape });

    expect(result.steps[2]).toMatchObject({ aggregateShape, aggregateShapeWaterAdjustment: adjustment, waterContent });
  });
});
