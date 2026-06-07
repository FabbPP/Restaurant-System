const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM mesas ORDER BY numero');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, numero, capacidad, estado = 'LIBRE', habilitada = true, activo = true } = req.body;
    await db.query('INSERT INTO mesas (id, numero, capacidad, estado, habilitada, activo) VALUES ($1,$2,$3,$4,$5,$6)', [id, numero, capacidad, estado, habilitada, activo]);
    res.status(201).json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    const set = [];
    const vals = [];
    let i = 1;
    for (const k in fields) {
      set.push(`${k} = $${i}`);
      vals.push(fields[k]);
      i++;
    }
    if (set.length === 0) return res.status(400).json({ error: 'No fields' });
    vals.push(id);
    const q = `UPDATE mesas SET ${set.join(', ')} WHERE id = $${i}`;
    await db.query(q, vals);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
