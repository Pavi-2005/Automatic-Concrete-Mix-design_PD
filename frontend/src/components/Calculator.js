import React, { useState } from 'react';
import { mixAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const Calculator = () => {
  const [formData, setFormData] = useState({
    grade: 'M30',
    cementType: 'OPC 43',
    maxAggregateSize: 20,
    exposureCondition: 'moderate',
    concreteType: 'reinforced',
    minCementContent: 0,
    slump: 50,
    placingMethod: 'vibrated',
    standardDeviation: 5,
    faZone: 'zone2',
    spGravityCement: 3.15,
    spGravityFa: 2.6,
    spGravityCa: 2.7,
    mineralAdmixtureType: '',
    waterCementRatio: 0.45,
    needSuperplasticizer: false,
    superplasticizerPercentage: 0,
    specimenType: 'cube',
    specimenCount: 1,
    caWaterAbsorption: 0,
    faWaterAbsorption: 0,
    wastagePercentage: 3
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submit formData:', formData); // Frontend log
    setLoading(true);
    setError('');

    // Validate superplasticizer
    if (formData.needSuperplasticizer && formData.superplasticizerPercentage > 2) {
      setError('Superplasticizer percentage must be below 2%');
      setLoading(false);
      return;
    }

    if (!formData.specimenCount || formData.specimenCount < 1 || formData.specimenCount > 100) {
      setError('Number of specimens must be between 1 and 100');
      setLoading(false);
      return;
    }

    try {
      const { data } = await mixAPI.calculate(formData);
      console.log('Calc success:', data);
      navigate(`/result/${data.id}`);
    } catch (err) {
      console.error('Calc err:', err.response);
      setError(err.response?.data?.errors?.[0] || err.response?.data?.message || 'Calculation failed');
    }
    setLoading(false);
  };

  return (
    <div className="page-layout">
      <div className="page-card">
        <button type="button" onClick={() => navigate('/dashboard')} style={{ marginBottom: '1.5rem', background: '#6b7280', alignSelf: 'flex-start' }}>
          ← Back to Dashboard
        </button>
        <h2>Mix Design Calculator (IS 10262:2019)</h2>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field-row">
            <label>Grade</label>
            <select value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })}>
              <option value="M25">M25</option>
              <option value="M30">M30</option>
              <option value="M35">M35</option>
              <option value="M40">M40</option>
              <option value="M45">M45</option>
              <option value="M50">M50</option>
              <option value="M55">M55</option>
              <option value="M60">M60</option>
              <option value="M65">M65</option>
              <option value="M70">M70</option>
              <option value="M75">M75</option>
              <option value="M80">M80</option>
            </select>
          </div>

          <div className="field-row">
            <label>Specimen Type</label>
            <select value={formData.specimenType} onChange={e => setFormData({ ...formData, specimenType: e.target.value })}>
              <option value="cube">Cube (150x150x150 mm)</option>
              <option value="prism">Prism (100x100x500 mm)</option>
              <option value="cylinder">Cylinder (150 mm dia x 300 mm height)</option>
            </select>
          </div>

          <div className="field-row">
            <label>Number of Specimens</label>
            <input type="number" min="1" max="100" value={formData.specimenCount} onChange={e => setFormData({ ...formData, specimenCount: parseInt(e.target.value, 10) || 1 })} />
          </div>

          <div className="field-row">
            <label>Cement Type</label>
            <select value={formData.cementType} onChange={e => setFormData({...formData, cementType: e.target.value})}>
              <option value="OPC 43">OPC 43</option>
              <option value="OPC 53">OPC 53</option>
              <option value="PPC">PPC</option>
            </select>
          </div>

          <div className="field-row">
            <label>Max Aggregate Size (mm)</label>
            <select value={formData.maxAggregateSize} onChange={e => setFormData({...formData, maxAggregateSize: parseFloat(e.target.value)})}>
              <option value={10}>10</option>
              <option value={12.5}>12.5</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
            </select>
          </div>

          <div className="field-row">
            <label>Exposure Condition</label>
            <select value={formData.exposureCondition} onChange={e => setFormData({...formData, exposureCondition: e.target.value})}>
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
              <option value="verySevere">Very Severe</option>
              <option value="extreme">Extreme</option>
            </select>
          </div>

          <div className="field-row">
            <label>Concrete Type</label>
            <select value={formData.concreteType} onChange={e => setFormData({...formData, concreteType: e.target.value})}>
              <option value="reinforced">Reinforced Concrete</option>
              <option value="plain">Plain Concrete</option>
            </select>
          </div>

          <div className="field-row">
            <label>Slump (mm)</label>
            <input type="number" min="25" max="150" value={formData.slump} onChange={e => setFormData({...formData, slump: parseFloat(e.target.value)})} />
          </div>

          <div className="field-row">
            <label>Need Superplasticizer?</label>
            <select value={formData.needSuperplasticizer ? 'yes' : 'no'} onChange={e => setFormData({...formData, needSuperplasticizer: e.target.value === 'yes', superplasticizerPercentage: e.target.value === 'no' ? 0 : formData.superplasticizerPercentage})}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          {formData.needSuperplasticizer && (
            <div className="field-row">
              <label>Superplasticizer Percentage (%)</label>
              <input type="number" min="0" max="5" step="0.1" value={formData.superplasticizerPercentage} onChange={e => setFormData({...formData, superplasticizerPercentage: parseFloat(e.target.value)})} />
              {formData.superplasticizerPercentage > 2 && <p style={{color: 'red', fontSize: '0.8em'}}>More than limit (2%), please choose below 2%</p>}
            </div>
          )}

          <div className="field-row">
            <label>Standard Deviation (N/mm²)</label>
            <select value={formData.standardDeviation} onChange={e => setFormData({...formData, standardDeviation: parseFloat(e.target.value)})}>
              <option value={4}>4</option>
              <option value={5}>5</option>
              <option value={6}>6</option>
            </select>
          </div>

          <div className="field-row">
            <label>Fine Aggregate Zone</label>
            <select value={formData.faZone} onChange={e => setFormData({...formData, faZone: e.target.value})}>
              <option value="zone1">Zone I - Coarse</option>
              <option value="zone2">Zone II - Medium</option>
              <option value="zone3">Zone III - Fine</option>
              <option value="zone4">Zone IV - Very Fine</option>
            </select>
          </div>

          <div className="field-row">
            <label>Placing Method</label>
            <select value={formData.placingMethod} onChange={e => setFormData({...formData, placingMethod: e.target.value})}>
              <option value="vibrated">Vibrated</option>
              <option value="pump">Pump</option>
            </select>
          </div>

          <div className="field-row">
            <label>Cement Specific Gravity</label>
            <input type="number" step="0.01" value={formData.spGravityCement} onChange={e => setFormData({...formData, spGravityCement: parseFloat(e.target.value)})} />
          </div>

          <div className="field-row">
            <label>Fine Aggregate Specific Gravity</label>
            <input type="number" step="0.01" value={formData.spGravityFa} onChange={e => setFormData({...formData, spGravityFa: parseFloat(e.target.value)})} />
          </div>

          <div className="field-row">
            <label>Coarse Aggregate Specific Gravity</label>
            <input type="number" step="0.01" value={formData.spGravityCa} onChange={e => setFormData({...formData, spGravityCa: parseFloat(e.target.value)})} />
          </div>

          <div className="field-row">
            <label>Coarse Aggregate Water Absorption (%)</label>
            <input type="number" min="0" step="0.1" value={formData.caWaterAbsorption} onChange={e => setFormData({...formData, caWaterAbsorption: parseFloat(e.target.value) || 0})} />
            {formData.caWaterAbsorption > 2 && <p style={{color: 'red', fontSize: '0.8em'}}>Above the recommended 2% limit.</p>}
          </div>

          <div className="field-row">
            <label>Fine Aggregate Water Absorption (%)</label>
            <input type="number" min="0" step="0.1" value={formData.faWaterAbsorption} onChange={e => setFormData({...formData, faWaterAbsorption: parseFloat(e.target.value) || 0})} />
            {formData.faWaterAbsorption > 3 && <p style={{color: 'red', fontSize: '0.8em'}}>Above the recommended 3% limit.</p>}
          </div>

          <div className="field-row">
            <label>Wastage (%)</label>
            <input type="number" min="0" step="0.1" value={formData.wastagePercentage} onChange={e => setFormData({...formData, wastagePercentage: parseFloat(e.target.value) || 0})} />
          </div>

          <button type="submit" disabled={loading}>{loading ? 'Calculating...' : 'Calculate'}</button>
        </form>
        {error && <p className="error-message">{error}</p>}
        <p className="small-note">Based on IS 10262:2019 - Indian Standard Code of Practice for Plain and Reinforced Concrete Mix Design</p>
      </div>
    </div>
  );
};

export default Calculator;

