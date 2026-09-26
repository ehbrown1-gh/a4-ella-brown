const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;
app.use(express.json({ limit: '100kb' }));

let appdata = [
  {
    name: 'Demo Player',
    score: 5,
    comment: 'Example score',
    submittedAt: '2026-09-02T18:00:00.000Z',
    scoreLevel: 'Beginner'
  }
];

function addDerivedField(item) {
  const score = Number(item.score) || 0;
  let scoreLevel = 'Beginner';
  if (score >= 20) scoreLevel = 'Expert';
  else if (score >= 10) scoreLevel = 'Advanced';
  return { ...item, score, scoreLevel };
}

function cleanIncomingData(data) {
  return {
    name: String(data.name || '').trim().slice(0, 40),
    score: Number.isFinite(Number(data.score)) ? Math.max(0, Number(data.score)) : 0,
    comment: String(data.comment || '').trim().slice(0, 300),
    submittedAt: data.submittedAt || new Date().toISOString()
  };
}

app.get('/api/data', (_req, res) => res.json(appdata));

app.post('/api/data', (req, res) => {
  const incoming = req.body || {};
  if (!String(incoming.name || '').trim()) {
    return res.status(400).json({ error: 'Name is required.' });
  }
  if (!incoming.comment && incoming.score === undefined) {
    return res.status(400).json({ error: 'A score or comment is required.' });
  }
  appdata.push(addDerivedField(cleanIncomingData(incoming)));
  return res.status(201).json(appdata);
});

app.put('/api/data', (req, res) => {
  const incoming = req.body || {};
  const index = Number(incoming.index);
  if (!Number.isInteger(index) || index < 0 || index >= appdata.length) {
    return res.status(404).json({ error: 'Entry not found.' });
  }
  appdata[index] = addDerivedField(cleanIncomingData(incoming));
  return res.json(appdata);
});

app.delete('/api/data', (req, res) => {
  const index = Number(req.body?.index);
  if (!Number.isInteger(index) || index < 0 || index >= appdata.length) {
    return res.status(404).json({ error: 'Entry not found.' });
  }
  appdata.splice(index, 1);
  return res.json(appdata);
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).send('Build the Svelte frontend first with npm run build.');
  });
});

app.listen(port, () => {
  console.log(`Snake game server running on port ${port}`);
});
