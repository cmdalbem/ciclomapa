import React from 'react';
import './App.css';
import { getMappingCompleteness } from './utils';

function App() {
  const [completeness, setCompleteness] = React.useState(0);
  const [accuracy, setAccuracy] = React.useState(0);

  React.useEffect(() => {
    const completeness = getMappingCompleteness();
    setCompleteness(completeness);
    setAccuracy(calculateAccuracy(completeness));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>CicloMapa</h1>
        <p>Confidence Indicator: {getIndicator(completeness, accuracy)}</p>
      </header>
    </div>
  );
}

function getIndicator(completeness, accuracy) {
  if (completeness > 80 && accuracy > 80) return "✅";
  else if (completeness > 50 && accuracy > 50) return "⚠";
  else return "❌";
}

function calculateAccuracy(completeness) {
  // TO DO: implement accuracy calculation logic
  return 50;
}

export default App;