import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import GetStarted from './components/GetStarted';
import Dashboard from './components/Dashboard';
import Calculator from './components/Calculator';
import History from './components/History';
import Result from './components/Result';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="app-header">
          <div className="app-header-brand">Concrete Mix Design</div>
        </header>
        <Routes>
          <Route path="/" element={<GetStarted />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/calculate" element={<Calculator />} />
  <Route path="/history" element={<History />} />
          <Route path="/result/:id" element={<Result />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

