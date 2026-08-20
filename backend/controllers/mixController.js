const { calculateMixDesign, validateInputs } = require('../services/mixDesignService');
const MixDesign = require('../models/MixDesign');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const auth = require('../middleware/auth');

// Helper function for step titles
const getStepTitle = (stepNumber) => {
  const titles = {
    1: 'Target Mean Strength Calculation',
    2: 'Water-Cement Ratio Determination',
    3: 'Water Content Estimation',
    4: 'Cement Content Calculation',
    5: 'Aggregate Proportions',
    6: 'Moisture Corrections'
  };
  return titles[stepNumber] || `Step ${stepNumber}`;
};

const calculate = async (req, res) => {
  console.log('Mix calculate request body:', JSON.stringify(req.body, null, 2));
  console.log('User ID:', req.user.id);
  try {
    const { calculateMixDesign, validateInputs } = require('../services/mixDesignService');
    const errors = validateInputs(req.body);
    console.log('Validation errors:', errors);
    if (errors.length > 0) return res.status(400).json({ errors });

    const result = await calculateMixDesign(req.body, req.user.id);
    console.log('Calc result ID:', result.id);
    res.json(result);
  } catch (err) {
    console.error('Calc error:', err.stack);
    res.status(500).json({ message: err.message });
  }
};

const getHistory = async (req, res) => {
  try {
    const history = await MixDesign.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(20);
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getMix = async (req, res) => {
  try {
    const mix = await MixDesign.findById(req.params.id);
    if (!mix || mix.userId.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Mix not found' });
    }
    res.json(mix);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PDF Export
const exportPDF = async (req, res) => {
  try {
    const mix = await MixDesign.findById(req.params.id).populate('userId', 'name');
    if (!mix || mix.userId._id.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=concrete-mix-${req.params.id}.pdf`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('Concrete Mix Design Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica').text(`IS 10262:2019 Compliant`, { align: 'center' });
    doc.moveDown(1);

    // Project Information
    doc.fontSize(14).font('Helvetica-Bold').text('Project Information');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`User: ${mix.userId.name}`);
    doc.text(`Date: ${new Date(mix.createdAt).toLocaleDateString()}`);
    doc.text(`Mix ID: ${mix._id}`);
    doc.moveDown(1);

    // Input Parameters
    doc.fontSize(14).font('Helvetica-Bold').text('Input Parameters');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    const inputs = mix.inputData;
    doc.text(`Grade: ${inputs.grade}`);
    doc.text(`Cement Type: ${inputs.cementType}`);
    doc.text(`Max Aggregate Size: ${inputs.maxAggregateSize} mm`);
    doc.text(`Exposure Condition: ${inputs.exposureCondition}`);
    doc.text(`Slump: ${inputs.slump} mm`);
    doc.text(`Fine Aggregate Zone: ${inputs.faZone}`);
    doc.text(`Specific Gravity - Cement: ${inputs.spGravityCement}`);
    doc.text(`Specific Gravity - Fine Aggregate: ${inputs.spGravityFa}`);
    doc.text(`Specific Gravity - Coarse Aggregate: ${inputs.spGravityCa}`);
    doc.moveDown(1);

    // Detailed Calculation Steps
    doc.fontSize(14).font('Helvetica-Bold').text('Detailed Calculation Steps (IS 10262:2019)');
    doc.moveDown(0.5);

    mix.resultData.steps.forEach((step, index) => {
      doc.fontSize(12).font('Helvetica-Bold').text(`${index + 1}. ${getStepTitle(step.step)}`);
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica');

      switch (step.step) {
        case 1:
          doc.text(`Formula: f'ck = fck + 1.65 × s`);
          doc.text(`Target Strength = ${step.targetStrength} MPa`);
          doc.text(`Standard Deviation = ${step.standardDeviation} MPa`);
          break;
        case 2:
          doc.text(`Water-Cement Ratio: Min(strength requirement, durability requirement)`);
          doc.text(`From Strength = ${step.wcStrength}`);
          doc.text(`From Durability = ${step.wcDurability}`);
          doc.text(`Selected = ${step.wcRatio}`);
          break;
        case 3:
          doc.text(`IS 10262:2019 Table 4 + Slump Adjustment`);
          doc.text(`Base Water Content = ${step.baseWater} kg/m³`);
          doc.text(`Slump Adjustment = ${step.slumpAdjustment} kg/m³`);
          doc.text(`Total = ${step.waterContent} kg/m³`);
          break;
        case 4:
          doc.text(`Formula: Cement = Water Content ÷ W/C Ratio`);
          doc.text(`Cement Content = ${step.cementContent} kg/m³`);
          doc.text(`Limits = ${step.cementLimits}`);
          break;
        case 5:
          doc.text(`IS 10262:2019 Table 5 - Coarse Aggregate Volume Ratios`);
          doc.text(`CA Volume Ratio = ${step.caVolumeRatio}`);
          doc.text(`Air Content = ${step.airContent}%`);
          doc.text(`Fine Aggregate = ${step.faContent} kg/m³`);
          doc.text(`Coarse Aggregate = ${step.caContent} kg/m³`);
          break;
        case 6:
          doc.text(`IS 10262:2019 Clause 5.6 - Surface Moisture & Absorption`);
          doc.text(`Additional Water = ${step.moistureCorrections.additionalWater} kg/m³`);
          doc.text(`FA Absorption = ${step.moistureCorrections.faAbsorption}%`);
          doc.text(`CA Absorption = ${step.moistureCorrections.caAbsorption}%`);
          break;
      }

      doc.moveDown(0.5);
    });

    // Final Mix Proportions
    doc.addPage();
    doc.fontSize(14).font('Helvetica-Bold').text('Final Mix Proportions');
    doc.moveDown(0.5);

    const finalMix = mix.resultData.finalMix;
    doc.fontSize(12).font('Helvetica-Bold').text('Materials per Cubic Meter of Concrete:');
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`• Cement: ${finalMix.cement} kg/m³`);
    doc.text(`• Water: ${finalMix.water} kg/m³`);
    doc.text(`• Fine Aggregate: ${finalMix.fa} kg/m³`);
    doc.text(`• Coarse Aggregate: ${finalMix.ca} kg/m³`);
    doc.text(`• Water-Cement Ratio: ${finalMix.w_c_ratio}`);

    if (mix.resultData.specimenResult) {
      doc.moveDown(1);
      doc.fontSize(12).font('Helvetica-Bold').text('Specimen Quantities');
      doc.moveDown(0.5);
      const specimen = mix.resultData.specimenResult;
      doc.fontSize(10).font('Helvetica');
      doc.text(`Specimen Type: ${specimen.specimenType}`);
      doc.text(`Specimen count: ${specimen.specimenCount}`);
      doc.text(`Total specimen volume: ${specimen.totalSpecimenMix?.volume_m3 ?? specimen.specimenVolume} m³`);
      doc.text(`Cement for ${specimen.specimenCount} specimen${specimen.specimenCount === 1 ? '' : 's'}: ${specimen.totalSpecimenMix?.cement ?? specimen.perSpecimenMix?.cement} kg`);
      doc.text(`Water for ${specimen.specimenCount} specimen${specimen.specimenCount === 1 ? '' : 's'}: ${specimen.totalSpecimenMix?.water ?? specimen.perSpecimenMix?.water} kg`);
      doc.text(`Fine Aggregate for ${specimen.specimenCount} specimen${specimen.specimenCount === 1 ? '' : 's'}: ${specimen.totalSpecimenMix?.fa ?? specimen.perSpecimenMix?.fa} kg`);
      doc.text(`Coarse Aggregate for ${specimen.specimenCount} specimen${specimen.specimenCount === 1 ? '' : 's'}: ${specimen.totalSpecimenMix?.ca ?? specimen.perSpecimenMix?.ca} kg`);
    }

    doc.moveDown(1);
    doc.fontSize(10).font('Helvetica-Oblique');
    doc.text('Note: All calculations follow IS 10262:2019 - Indian Standard Code of Practice for Plain and Reinforced Concrete Mix Design');
    doc.text('This report is generated automatically and should be verified by a qualified engineer before use in construction.');

    doc.end();
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Excel Export
const exportExcel = async (req, res) => {
  try {
    console.log('Excel export requested for ID:', req.params.id);
    console.log('User ID from token:', req.user.id);

    const mix = await MixDesign.findById(req.params.id).populate('userId', 'name');
    console.log('Mix found:', !!mix);
    console.log('Mix userId:', mix?.userId);

    if (!mix || !mix.userId || mix.userId._id.toString() !== req.user.id) {
      console.log('Access denied or mix not found');
      return res.status(404).json({ message: 'Not found' });
    }

    console.log('Creating Excel workbook...');

    const workbook = new ExcelJS.Workbook();

    // Summary Sheet
    const summarySheet = workbook.addWorksheet('Summary');
    summarySheet.getColumn('A').width = 20;
    summarySheet.getColumn('B').width = 30;

    // Title
    summarySheet.mergeCells('A1:B1');
    summarySheet.getCell('A1').value = 'Concrete Mix Design Report';
    summarySheet.getCell('A1').font = { size: 16, bold: true };
    summarySheet.getCell('A1').alignment = { horizontal: 'center' };

    summarySheet.mergeCells('A2:B2');
    summarySheet.getCell('A2').value = 'IS 10262:2019 Compliant';
    summarySheet.getCell('A2').font = { size: 12, italic: true };
    summarySheet.getCell('A2').alignment = { horizontal: 'center' };

    // Project Info
    let row = 4;
    summarySheet.getCell(`A${row}`).value = 'Project Information';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    row++;

    summarySheet.getCell(`A${row}`).value = 'User';
    summarySheet.getCell(`B${row}`).value = mix.userId.name;
    row++;

    summarySheet.getCell(`A${row}`).value = 'Date';
    summarySheet.getCell(`B${row}`).value = new Date(mix.createdAt).toLocaleDateString();
    row++;

    summarySheet.getCell(`A${row}`).value = 'Mix ID';
    summarySheet.getCell(`B${row}`).value = mix._id.toString();
    row += 2;

    // Input Parameters
    summarySheet.getCell(`A${row}`).value = 'Input Parameters';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    row++;

    const inputs = mix.inputData;
    const inputData = [
      ['Grade', inputs.grade],
      ['Cement Type', inputs.cementType],
      ['Max Aggregate Size', `${inputs.maxAggregateSize} mm`],
      ['Exposure Condition', inputs.exposureCondition],
      ['Slump', `${inputs.slump} mm`],
      ['Fine Aggregate Zone', inputs.faZone],
      ['Specific Gravity - Cement', inputs.spGravityCement],
      ['Specific Gravity - Fine Aggregate', inputs.spGravityFa],
      ['Specific Gravity - Coarse Aggregate', inputs.spGravityCa]
    ];

    inputData.forEach(([label, value]) => {
      summarySheet.getCell(`A${row}`).value = label;
      summarySheet.getCell(`B${row}`).value = value;
      row++;
    });

    row += 2;

    // Final Mix
    summarySheet.getCell(`A${row}`).value = 'Final Mix Proportions (kg/m³)';
    summarySheet.getCell(`A${row}`).font = { bold: true };
    row++;

    const finalMix = mix.resultData.finalMix;
    const mixData = [
      ['Cement', finalMix.cement],
      ['Water', finalMix.water],
      ['Fine Aggregate', finalMix.fa],
      ['Coarse Aggregate', finalMix.ca],
      ['Water-Cement Ratio', finalMix.w_c_ratio]
    ];

    mixData.forEach(([label, value]) => {
      summarySheet.getCell(`A${row}`).value = label;
      summarySheet.getCell(`B${row}`).value = value;
      row++;
    });

    if (mix.resultData.specimenResult) {
      row += 1;
      summarySheet.getCell(`A${row}`).value = 'Specimen Quantities';
      summarySheet.getCell(`A${row}`).font = { bold: true };
      row++;
      const specimen = mix.resultData.specimenResult;
      const specimenRows = [
        ['Specimen Type', specimen.specimenType],
        ['Specimen Count', specimen.specimenCount],
        ['Total Specimen Volume (m³)', specimen.totalSpecimenMix?.volume_m3 ?? specimen.specimenVolume],
        ['Cement for specimens (kg)', specimen.totalSpecimenMix?.cement ?? specimen.perSpecimenMix?.cement],
        ['Water for specimens (kg)', specimen.totalSpecimenMix?.water ?? specimen.perSpecimenMix?.water],
        ['Fine Aggregate for specimens (kg)', specimen.totalSpecimenMix?.fa ?? specimen.perSpecimenMix?.fa],
        ['Coarse Aggregate for specimens (kg)', specimen.totalSpecimenMix?.ca ?? specimen.perSpecimenMix?.ca]
      ];
      specimenRows.forEach(([label, value]) => {
        summarySheet.getCell(`A${row}`).value = label;
        summarySheet.getCell(`B${row}`).value = value;
        row++;
      });
    }

    // Detailed Steps Sheet
    const stepsSheet = workbook.addWorksheet('Calculation Steps');
    stepsSheet.getColumn('A').width = 5;
    stepsSheet.getColumn('B').width = 35;
    stepsSheet.getColumn('C').width = 50;
    stepsSheet.getColumn('D').width = 30;

    // Header
    stepsSheet.getCell('A1').value = 'Step';
    stepsSheet.getCell('B1').value = 'Calculation';
    stepsSheet.getCell('C1').value = 'Details';
    stepsSheet.getCell('D1').value = 'Values';
    ['A1', 'B1', 'C1', 'D1'].forEach(cell => {
      stepsSheet.getCell(cell).font = { bold: true };
      stepsSheet.getCell(cell).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6FA' }
      };
    });

    let stepRow = 2;
    console.log('Steps data:', JSON.stringify(mix.resultData.steps, null, 2));
    mix.resultData.steps.forEach((step) => {
      console.log('Processing step:', step.step, 'data:', step);
      stepsSheet.getCell(`A${stepRow}`).value = step.step;
      stepsSheet.getCell(`B${stepRow}`).value = getStepTitle(step.step);

      switch (step.step) {
        case 1:
          stepsSheet.getCell(`C${stepRow}`).value = 'Formula: f\'ck = fck + 1.65 × s';
          stepsSheet.getCell(`D${stepRow}`).value = `Target: ${step.targetStrength} MPa, SD: ${step.standardDeviation} MPa`;
          break;
        case 2:
          stepsSheet.getCell(`C${stepRow}`).value = 'Min(strength requirement, durability requirement)';
          stepsSheet.getCell(`D${stepRow}`).value = `Strength: ${step.wcStrength}, Durability: ${step.wcDurability}, Selected: ${step.wcRatio}`;
          break;
        case 3:
          stepsSheet.getCell(`C${stepRow}`).value = 'IS 10262:2019 Table 4 + Slump Adjustment';
          stepsSheet.getCell(`D${stepRow}`).value = `Base: ${step.baseWater}, Adjustment: ${step.slumpAdjustment}, Total: ${step.waterContent} kg/m³`;
          break;
        case 4:
          stepsSheet.getCell(`C${stepRow}`).value = 'Cement = Water Content ÷ W/C Ratio';
          stepsSheet.getCell(`D${stepRow}`).value = `Cement: ${step.cementContent} kg/m³, Limits: ${step.cementLimits}`;
          break;
        case 5:
          stepsSheet.getCell(`C${stepRow}`).value = 'IS 10262:2019 Table 5 - Volume Ratios';
          stepsSheet.getCell(`D${stepRow}`).value = `CA Ratio: ${step.caVolumeRatio}, Air: ${step.airContent}%, FA: ${step.faContent}, CA: ${step.caContent} kg/m³`;
          break;
        case 6:
          stepsSheet.getCell(`C${stepRow}`).value = 'IS 10262:2019 Clause 5.6 - Moisture Corrections';
          stepsSheet.getCell(`D${stepRow}`).value = `Additional Water: ${step.moistureCorrections.additionalWater} kg/m³`;
          break;
      }
      stepRow++;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=concrete-mix-${req.params.id}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
    console.log('Excel export completed successfully');
  } catch (err) {
    console.error('Excel export error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { calculate, getHistory, getMix, exportPDF, exportExcel };

