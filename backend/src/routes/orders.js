const express = require('express');
const db = require('../db');
const router = express.Router();

// List orders
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM ordenes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single order with items
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ordenRes = await db.query('SELECT * FROM ordenes WHERE id = $1', [id]);
    if (ordenRes.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    const itemsRes = await db.query('SELECT * FROM orden_items WHERE orden_id = $1', [id]);
    res.json({ ...ordenRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create order with items (transaction)
router.post('/', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id, tipo, mesa_id = null, mesero_id = null, cliente = null, items = [] } = req.body;
    await client.query('BEGIN');
    await client.query('INSERT INTO ordenes (id, tipo, mesa_id, mesero_id, cliente, estado, total_cents) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, tipo, mesa_id, mesero_id, cliente, 'PENDIENTE', 0]);
    let total = 0;
    for (const it of items) {
      await client.query('INSERT INTO orden_items (orden_id, producto_id, cantidad, precio_cents) VALUES ($1,$2,$3,$4)', [id, it.producto_id, it.cantidad, it.precio_cents]);
      total += (it.precio_cents * it.cantidad);
    }
    await client.query('UPDATE ordenes SET total_cents = $1 WHERE id = $2', [total, id]);
    await client.query('COMMIT');
    res.status(201).json({ id, total_cents: total });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
