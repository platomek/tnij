const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = 3000;

// Połączenie z bazą danych SQLite (plik urls.db powstanie automatycznie)
const db = new sqlite3.Database('./urls.db', (err) => {
    if (err) console.error('Błąd bazy danych:', err.message);
    else console.log('Połączono z bazą danych SQLite.');
});

// Tworzenie tabeli w bazie danych, jeśli nie istnieje
db.run(`
    CREATE TABLE IF NOT EXISTS urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_url TEXT NOT NULL,
        short_code TEXT UNIQUE NOT NULL,
        clicks INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

// Middleware do obsługi formularzy i plików statycznych
app.use(express.urlencoded({ extended: true }));

// Funkcja pomocnicza do generowania losowego kodu
function generateRandomCode(length = 6) {
    return crypto.randomBytes(length).toString('base64url').substring(0, length);
}

// ------------------- ROUTY / ŚCIEŻKI -------------------

// 1. Strona główna z formularzem i listą linków
app.get('/', (req, res) => {
    db.all(`SELECT * FROM urls ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).send('Błąd serwera');

        let rowsHtml = rows.map(row => `
            <tr>
                <td><a href="${row.original_url}" target="_blank">${row.original_url}</a></td>
                <td><a href="/${row.short_code}" target="_blank">http://localhost:${PORT}/${row.short_code}</a></td>
                <td><strong>${row.clicks}</strong></td>
            </tr>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html lang="pl">
            <head>
                <meta charset="UTF-8">
                <title>Skracacz Linków Node.js</title>
                <style>
                    body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; }
                    form { background: #f4f4f4; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
                    .form-group { margin-bottom: 15px; }
                    label { display: block; margin-bottom: 5px; font-weight: bold; }
                    input[type="text"], input[type="url"] { width: 100%; padding: 8px; box-sizing: border-box; }
                    button { padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; }
                    button:hover { background: #218838; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; word-break: break-all; }
                    th { background-color: #f8f9fa; }
                    .error { color: red; margin-bottom: 15px; }
                </style>
            </head>
            <body>
                <h2>Skracacz Linków (Node.js + SQLite)</h2>
                
                ${req.query.error ? `<p class="error">${req.query.error}</p>` : ''}

                <form action="/shorten" method="POST">
                    <div class="form-group">
                        <label for="url">Długi URL (wymagany):</label>
                        <input type="url" id="url" name="url" placeholder="https://bardzo-dlugi-adres.pl/sciezka" required>
                    </div>
                    <div class="form-group">
                        <label for="custom_alias">Własny alias (opcjonalnie):</label>
                        <input type="text" id="custom_alias" name="custom_alias" placeholder="np. moj-link">
                    </div>
                    <button type="submit">Skróć link</button>
                </form>

                <h3>Wygenerowane linki i statystyki</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Oryginalny URL</th>
                            <th>Skrócony URL</th>
                            <th>Kliknięcia</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml || '<tr><td colspan="3">Brak skróconych linków.</td></tr>'}
                    </tbody>
                </table>
            </body>
            </html>
        `);
    });
});

// 2. Obsługa tworzenia nowego skróconego linku
app.post('/shorten', (req, res) => {
    const originalUrl = req.body.url;
    let customAlias = req.body.custom_alias ? req.body.custom_alias.trim() : null;

    let shortCode = customAlias || generateRandomCode();

    // Wstawienie do bazy danych
    db.run(
        `INSERT INTO urls (original_url, short_code) VALUES (?, ?)`,
        [originalUrl, shortCode],
        function (err) {
            if (err) {
                // Kod błędu dla unikalności w SQLite to SQLITE_CONSTRAINT
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.redirect('/?error=' + encodeURIComponent('Ten własny alias jest już zajęty! Wybierz inny.'));
                }
                return res.redirect('/?error=' + encodeURIComponent('Wystąpił błąd bazy danych.'));
            }
            res.redirect('/');
        }
    );
});

// 3. Przekierowanie i zliczanie kliknięć
app.get('/:code', (req, res) => {
    const code = req.params.code;

    // Znajdź link w bazie
    db.get(`SELECT * FROM urls WHERE short_code = ?`, [code], (err, row) => {
        if (err || !row) {
            return res.status(404).send('Nie znaleziono takiego linku!');
        }

        // Zwiększ licznik kliknięć o 1
        db.run(`UPDATE urls SET clicks = clicks + 1 WHERE id = ?`, [row.id], (err) => {
            if (err) console.error('Błąd aktualizacji kliknięć:', err);
            
            // Przekierowanie na oryginalny URL
            res.redirect(row.original_url);
        });
    });
});

// Uruchomienie serwera
app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});