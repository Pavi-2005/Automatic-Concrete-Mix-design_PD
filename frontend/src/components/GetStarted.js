import React from 'react';
import { Link } from 'react-router-dom';

const GetStarted = () => {
  return (
    <div className="get-started-page">
      <div className="hero-section">
        <div className="hero-content">
          <h1>Professional Concrete Mix Design</h1>
          <p className="hero-subtitle">
            Design concrete mixes with precision using IS 10262:2019 standards.
            Calculate, analyze, and export professional mix designs for construction projects.
          </p>

          <div className="hero-actions">
            <Link to="/signup" className="cta-button primary">
              Get Started Free
            </Link>
            <Link to="/login" className="cta-button secondary">
              Sign In
            </Link>
          </div>

          <div className="hero-features">
            <div className="feature-item">
              <div className="feature-icon">📐</div>
              <h3>IS 10262:2019 Compliant</h3>
              <p>Follow Indian Standard specifications for accurate mix design</p>
            </div>

            <div className="feature-item">
              <div className="feature-icon">⚡</div>
              <h3>Instant Calculations</h3>
              <p>Get precise mix proportions in seconds with automated calculations</p>
            </div>

            <div className="feature-item">
              <div className="feature-icon">📊</div>
              <h3>Professional Reports</h3>
              <p>Export detailed PDF and Excel reports for project documentation</p>
            </div>

            <div className="feature-item">
              <div className="feature-icon">🔄</div>
              <h3>History Tracking</h3>
              <p>Save and review all your previous mix design calculations</p>
            </div>
          </div>

          <div className="hero-stats">
            <div className="stat-item">
              <div className="stat-number">15+</div>
              <div className="stat-label">Concrete Grades</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">IS</div>
              <div className="stat-label">10262:2019</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">PDF</div>
              <div className="stat-label">& Excel Export</div>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-placeholder">
            <div className="concrete-icon">🏗️</div>
            <div className="calculation-preview">
              <div className="preview-card">
                <h4>M30 Mix Design</h4>
                <div className="mix-components">
                  <div className="component">
                    <span className="label">Cement:</span>
                    <span className="value">380 kg/m³</span>
                  </div>
                  <div className="component">
                    <span className="label">Water:</span>
                    <span className="value">190 kg/m³</span>
                  </div>
                  <div className="component">
                    <span className="label">FA:</span>
                    <span className="value">760 kg/m³</span>
                  </div>
                  <div className="component">
                    <span className="label">CA:</span>
                    <span className="value">1140 kg/m³</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="standards-section">
        <div className="page-card">
          <h2>Built on Industry Standards</h2>
          <p>Our calculations follow the latest Indian Standard IS 10262:2019 for Plain and Reinforced Concrete Mix Design, ensuring accuracy and compliance for all your construction projects.</p>

          <div className="standards-grid">
            <div className="standard-item">
              <h4>IS 10262:2019</h4>
              <p>Plain and Reinforced Concrete - Code of Practice</p>
            </div>
            <div className="standard-item">
              <h4>IS 456:2000</h4>
              <p>Plain and Reinforced Concrete - Code of Practice</p>
            </div>
            <div className="standard-item">
              <h4>IS 383:2016</h4>
              <p>Coarse and Fine Aggregate for Concrete - Specification</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GetStarted;