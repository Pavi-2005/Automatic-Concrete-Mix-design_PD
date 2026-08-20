import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mixAPI } from '../services/api';

// Helper functions for detailed step rendering
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

const renderStepDetails = (step) => {
  switch (step.step) {
    case 1:
      return (
        <div className="calculation-details">
          <div className="formula">
            <strong>Formula:</strong> f'ck = fck + 1.65 × s
          </div>
          <div className="values">
            <span>Target Strength ({step.specimenType?.charAt(0).toUpperCase() + step.specimenType?.slice(1) || 'Cube'}) = {step.targetStrength} MPa</span>
            <span>Standard Deviation = {step.standardDeviation} MPa</span>
          </div>
        </div>
      );
    case 2:
      return (
        <div className="calculation-details">
          <div className="formula">
            <strong>Water-Cement Ratio:</strong> Min(strength requirement, durability requirement)
          </div>
          <div className="values">
            <span>From Strength = {step.wcStrength}</span>
            <span>From Durability = {step.wcDurability}</span>
            <span><strong>Selected = {step.wcRatio}</strong></span>
          </div>
        </div>
      );
    case 3:
      return (
        <div className="calculation-details">
          <div className="formula">
            <strong>IS 10262:2019 Table 4</strong> + Slump Adjustment + Superplasticizer Reduction
          </div>
          <div className="values">
            <span>Base Water Content = {step.baseWater} kg/m³</span>
            <span>Slump Adjustment = {step.slumpAdjustment} kg/m³</span>
            <span>Superplasticizer Reduction = {step.superplasticizerReduction}%</span>
            <span><strong>Total = {step.waterContent} kg/m³</strong></span>
          </div>
        </div>
      );
    case 4:
      return (
        <div className="calculation-details">
          <div className="formula">
            <strong>Formula:</strong> Cement = Water Content ÷ W/C Ratio
          </div>
          <div className="values">
            <span>Cement Content = {step.cementContent} kg/m³</span>
            <span>Limits = {step.cementLimits}</span>
          </div>
        </div>
      );
    case 5:
      return (
        <div className="calculation-details">
          <div className="formula">
            <strong>IS 10262:2019 Table 5</strong> - Coarse Aggregate Volume Ratios
          </div>
          <div className="values">
            <span>CA Volume Ratio = {step.caVolumeRatio}</span>
            <span>Air Content = {step.airContent}%</span>
            <span>Fine Aggregate = {step.faContent} kg/m³</span>
            <span>Coarse Aggregate = {step.caContent} kg/m³</span>
          </div>
        </div>
      );
    case 6:
      return (
        <div className="calculation-details">
          <div className="formula">
            <strong>IS 10262:2019 Clause 5.6</strong> - Surface Moisture & Absorption
          </div>
          <div className="values">
            <span>Additional Water = {step.moistureCorrections.additionalWater} kg/m³</span>
            <span>FA Absorption = {step.moistureCorrections.faAbsorption}%</span>
            <span>CA Absorption = {step.moistureCorrections.caAbsorption}%</span>
          </div>
        </div>
      );
    default:
      return <div>{JSON.stringify(step)}</div>;
  }
};

const getStepExplanation = (stepNumber) => {
  const explanations = {
    1: 'The target mean strength ensures 95% of concrete cubes will exceed the characteristic strength (fck) with a confidence level of 95%. The standard deviation depends on the number of test results available.',
    2: 'Water-cement ratio is the most critical factor affecting concrete strength and durability. It must satisfy both strength requirements (from empirical relationships) and durability requirements (from exposure conditions).',
    3: 'Water content is determined from IS 10262:2019 Table 4 based on maximum aggregate size. Additional water is added for slump requirements (±3 kg/m³ per 25mm slump change from reference).',
    4: 'Cement content is calculated as water content divided by water-cement ratio. IS 10262:2019 specifies minimum cement contents based on exposure conditions to ensure durability.',
    5: 'Aggregate proportions use volume ratios from IS 10262:2019 Table 5. The coarse aggregate volume ratio varies by fine aggregate zone and maximum aggregate size. Air content is estimated from Table 6.',
    6: 'Moisture corrections account for surface moisture in aggregates (which adds water) and water absorption by aggregates (which requires additional water to maintain SSD condition).'
  };
  return explanations[stepNumber] || '';
};

const getSpecimenVolume = (specimenType) => {
  switch (specimenType) {
    case 'cube':
      return 0.150 * 0.150 * 0.150;
    case 'prism':
      return 0.100 * 0.100 * 0.500;
    case 'cylinder':
      return Math.PI * 0.075 * 0.075 * 0.300;
    default:
      return 0.150 * 0.150 * 0.150;
  }
};

const Result = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);

  useEffect(() => {
    console.log('Loading result for ID:', id);
    mixAPI.get(id).then(({ data }) => {
      console.log('Result loaded:', data);
      setResult(data);
    }).catch(err => {
      console.error('Result load failed:', err);
    });
  }, [id]);

  if (!result) return (
    <div className="page-layout">
      <div className="loading-placeholder">
        <div className="loading-spinner"></div>
        <p style={{ marginTop: '1rem' }}>Loading results...</p>
      </div>
    </div>
  );

  const { steps, finalMix, specimenResult } = result.resultData;
  const computedSpecimenVolume = specimenResult?.specimenVolume ?? getSpecimenVolume(specimenResult?.specimenType);
  const computedPerSpecimenMix = specimenResult?.perSpecimenMix ?? {
    volume_m3: computedSpecimenVolume,
    cement: finalMix?.cement ? parseFloat((finalMix.cement * computedSpecimenVolume).toFixed(2)) : null,
    water: finalMix?.water ? parseFloat((finalMix.water * computedSpecimenVolume).toFixed(2)) : null,
    fa: finalMix?.fa ? parseFloat((finalMix.fa * computedSpecimenVolume).toFixed(2)) : null,
    ca: finalMix?.ca ? parseFloat((finalMix.ca * computedSpecimenVolume).toFixed(2)) : null,
    units: 'kg/specimen'
  };
  const specimenCount = specimenResult?.specimenCount || 1;
  const computedTotalSpecimenMix = specimenResult?.totalSpecimenMix ?? {
    volume_m3: parseFloat((computedSpecimenVolume * specimenCount).toFixed(6)),
    cement: computedPerSpecimenMix.cement != null ? parseFloat((computedPerSpecimenMix.cement * specimenCount).toFixed(2)) : null,
    water: computedPerSpecimenMix.water != null ? parseFloat((computedPerSpecimenMix.water * specimenCount).toFixed(2)) : null,
    fa: computedPerSpecimenMix.fa != null ? parseFloat((computedPerSpecimenMix.fa * specimenCount).toFixed(2)) : null,
    ca: computedPerSpecimenMix.ca != null ? parseFloat((computedPerSpecimenMix.ca * specimenCount).toFixed(2)) : null,
    units: `kg/${specimenCount} specimen${specimenCount === 1 ? '' : 's'}`
  };

  return (
    <div className="page-layout">
      <div className="page-card">
        <button type="button" onClick={() => navigate('/history')} style={{ marginBottom: '1.5rem', background: '#6b7280', alignSelf: 'flex-start' }}>
          ← Back to History
        </button>
        <h2>Mix Design Results</h2>
        
        <section style={{ marginTop: '2rem' }}>
          <h3>📊 Final Mix Proportions</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1.5rem',
            marginTop: '1.5rem'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              borderLeft: '4px solid #1e40af'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#1e40af', fontWeight: '600', marginBottom: '0.5rem' }}>Cement</div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e3a8a' }}>{finalMix.cement}</div>
              <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '0.5rem' }}>kg/m³</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              borderLeft: '4px solid #0891b2'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#0891b2', fontWeight: '600', marginBottom: '0.5rem' }}>Water</div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#164e63' }}>{finalMix.water}</div>
              <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '0.5rem' }}>kg/m³</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              borderLeft: '4px solid #92400e'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#92400e', fontWeight: '600', marginBottom: '0.5rem' }}>Fine Agg.</div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#78350f' }}>{finalMix.fa}</div>
              <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '0.5rem' }}>kg/m³</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              borderLeft: '4px solid #991b1b'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#991b1b', fontWeight: '600', marginBottom: '0.5rem' }}>Coarse Agg.</div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#7f1d1d' }}>{finalMix.ca}</div>
              <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '0.5rem' }}>kg/m³</div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
              padding: '1.5rem',
              borderRadius: '12px',
              borderLeft: '4px solid #065f46'
            }}>
              <div style={{ fontSize: '0.9rem', color: '#065f46', fontWeight: '600', marginBottom: '0.5rem' }}>W/C Ratio</div>
              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#064e3b' }}>{finalMix.w_c_ratio}</div>
              <div style={{ fontSize: '0.8rem', color: '#4b5563', marginTop: '0.5rem' }}>Ratio</div>
            </div>
          </div>
        </section>

        {specimenResult && (
          <section style={{ marginTop: '2rem' }}>
            <h3>💪 Selected Specimen Result</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
              gap: '1.5rem',
              marginTop: '1.5rem'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                padding: '1.5rem',
                borderRadius: '12px',
                borderLeft: '4px solid #0369a1'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#0369a1', fontWeight: '600', marginBottom: '0.5rem' }}>
                  {specimenResult.specimenType.charAt(0).toUpperCase() + specimenResult.specimenType.slice(1)} Specimen
                </div>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#0c4a6e' }}>
                  {specimenResult.targetStrength} MPa
                </div>
                <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#475569' }}>
                  Total volume: {computedTotalSpecimenMix.volume_m3 ? computedTotalSpecimenMix.volume_m3.toFixed(6) : '-'} m³
                </div>
                <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#475569' }}>
                  Specimen count: {specimenCount}
                </div>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                padding: '1.5rem',
                borderRadius: '12px',
                borderLeft: '4px solid #166534'
              }}>
                <div style={{ fontSize: '0.9rem', color: '#166534', fontWeight: '600', marginBottom: '0.5rem' }}>
                  Material for {specimenCount} specimen{specimenCount === 1 ? '' : 's'}
                </div>
                <div style={{ fontSize: '1rem', color: '#14532d', marginBottom: '0.5rem' }}>
                  Cement: {computedTotalSpecimenMix.cement != null ? computedTotalSpecimenMix.cement : '-'} kg
                </div>
                <div style={{ fontSize: '1rem', color: '#14532d', marginBottom: '0.5rem' }}>
                  Water: {computedTotalSpecimenMix.water != null ? computedTotalSpecimenMix.water : '-'} kg
                </div>
                <div style={{ fontSize: '1rem', color: '#14532d', marginBottom: '0.5rem' }}>
                  Fine Agg.: {computedTotalSpecimenMix.fa != null ? computedTotalSpecimenMix.fa : '-'} kg
                </div>
                <div style={{ fontSize: '1rem', color: '#14532d' }}>
                  Coarse Agg.: {computedTotalSpecimenMix.ca != null ? computedTotalSpecimenMix.ca : '-'} kg
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '1rem' }}>
              The calculation shows both per-cubic-meter proportions and the quantities needed for one selected specimen.
            </p>
          </section>
        )}

        <section style={{ marginTop: '3rem' }}>

          <h3>📝 Detailed Calculation Steps (IS 10262:2019)</h3>
          <div className="steps-container">
            {steps.map((step, i) => (
              <div key={i} className="step-card">
                <div className="step-header">
                  <span className="step-number">{step.step}</span>
                  <h4 className="step-title">{getStepTitle(step.step)}</h4>
                </div>
                <div className="step-content">
                  {renderStepDetails(step)}
                </div>
                <div className="step-explanation">
                  {getStepExplanation(step.step)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="action-buttons" style={{ marginTop: '2rem' }}>
          <button type="button" onClick={() => download('pdf', id)} className="btn-success">
            📄 Download PDF
          </button>
          <button type="button" onClick={() => download('excel', id)} className="btn-success">
            📊 Download Excel
          </button>
        </div>
      </div>
    </div>
  );
};

const download = async (type, id) => {
  try {
    const api = type === 'pdf' ? mixAPI.pdf : mixAPI.excel;
    const response = await api(id);
    const data = response.data;

    // Check if response is an error
    if (data && typeof data === 'object' && data.message) {
      alert(`Error downloading ${type.toUpperCase()}: ${data.message}`);
      return;
    }

    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mix-${id}.${type}`;
    a.click();
  } catch (error) {
    console.error(`Error downloading ${type}:`, error);
    alert(`Error downloading ${type.toUpperCase()}: ${error.response?.data?.message || error.message}`);
  }
};

export default Result;

