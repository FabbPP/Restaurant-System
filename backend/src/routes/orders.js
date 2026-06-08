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

// Update order and optionally replace items (transactional)
router.put('/:id', async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const { tipo, mesa_id, mesero_id, cliente, estado, items } = req.body;
    await client.query('BEGIN');

    const fields = [];
    const vals = [];
    let i = 1;
    if (tipo !== undefined) { fields.push(`tipo = $${i++}`); vals.push(tipo); }
    if (mesa_id !== undefined) { fields.push(`mesa_id = $${i++}`); vals.push(mesa_id); }
    if (mesero_id !== undefined) { fields.push(`mesero_id = $${i++}`); vals.push(mesero_id); }
    if (cliente !== undefined) { fields.push(`cliente = $${i++}`); vals.push(cliente); }
    if (estado !== undefined) { fields.push(`estado = $${i++}`); vals.push(estado); }

    if (fields.length > 0) {
      vals.push(id);
      const q = `UPDATE ordenes SET ${fields.join(', ')} WHERE id = $${i}`;
      await client.query(q, vals);
    }

    if (Array.isArray(items)) {
      // Replace items atomically
      await client.query('DELETE FROM orden_items WHERE orden_id = $1', [id]);
      let total = 0;
      for (const it of items) {
        await client.query('INSERT INTO orden_items (orden_id, producto_id, cantidad, precio_cents) VALUES ($1,$2,$3,$4)', [id, it.producto_id, it.cantidad, it.precio_cents]);
        total += (it.precio_cents * it.cantidad);
      }
      await client.query('UPDATE ordenes SET total_cents = $1 WHERE id = $2', [total, id]);
    }

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
