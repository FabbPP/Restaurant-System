const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM productos ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { id, nombre, precio_cents, disponibilidad = true, descripcion = '', estado = true, activo = true } = req.body;
    await db.query(
      'INSERT INTO productos (id, nombre, precio_cents, disponibilidad, descripcion, estado, activo) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, nombre, precio_cents, disponibilidad, descripcion, estado, activo]
    );
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
    const q = `UPDATE productos SET ${set.join(', ')} WHERE id = $${i}`;
    await db.query(q, vals);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Logical delete: set activo = false
    await db.query('UPDATE productos SET activo = false WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
