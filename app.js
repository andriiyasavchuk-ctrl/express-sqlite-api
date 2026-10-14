const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('app.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL
  )
`);

db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product TEXT NOT NULL,
    amount REAL NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Сервер працює!' });
});

app.post('/users', (req, res) => {
  const { name, role } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: "Поля name та role обов'язкові" });
  }

  const result = db.prepare('INSERT INTO users (name, role) VALUES (?, ?)').run(name, role);
  res.status(201).json({ id: Number(result.lastInsertRowid), name, role });
});

app.post('/users/batch', (req, res) => {
  const users = req.body;
  const placeholders = users.map(() => '(?, ?)').join(', ');
  const values = users.flatMap(u => [u.name, u.role]);

  const result = db.prepare(`INSERT INTO users (name, role) VALUES ${placeholders}`).run(...values);
  res.status(201).json({ createdCount: result.changes });
});

app.delete('/users/batch', (req, res) => {
  const { ids } = req.body;
  const placeholders = ids.map(() => '?').join(', ');

  const result = db.prepare(`DELETE FROM users WHERE id IN (${placeholders})`).run(...ids);
  res.json({ deletedCount: result.changes });
});

app.get('/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users);
});

app.get('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'Користувача не знайдено' });
  }
  res.json(user);
});

app.put('/users/:id', (req, res) => {
  const { name, role } = req.body;
  const result = db.prepare('UPDATE users SET name = ?, role = ? WHERE id = ?')
    .run(name, role, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Користувача не знайдено' });
  }
  res.json({ id: Number(req.params.id), name, role });
});

app.delete('/users/:id', (req, res) => {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Користувача не знайдено' });
  }
  res.status(204).send();
});

app.post('/orders', (req, res) => {
  const { user_id, product, amount } = req.body;
  const result = db.prepare('INSERT INTO orders (user_id, product, amount) VALUES (?, ?, ?)')
    .run(user_id, product, amount);
  res.status(201).json({ id: Number(result.lastInsertRowid), user_id, product, amount });
});

app.get('/orders', (req, res) => {
  const orders = db.prepare(`
    SELECT orders.id, orders.product, orders.amount, users.name AS user_name
    FROM orders
    JOIN users ON orders.user_id = users.id
  `).all();
  res.json(orders);
});

app.listen(3000, () => {
  console.log('Server is running at http://127.0.0.1:3000');
});
