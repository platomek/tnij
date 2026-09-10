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

// 1. Strona główna z nowym, nowoczesnym designem
app.get('/', (req, res) => {
    db.all(`SELECT * FROM urls ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).send('Błąd serwera');

        let rowsHtml = rows.map(row => `
            <tr>
                <td class="url-cell"><a href="${row.original_url}" target="_blank" rel="noopener">${row.original_url}</a></td>
                <td class="short-url-cell"><a href="/${row.short_code}" target="_blank" class="short-link">http://gornikleczna.pl/${row.short_code}</a></td>
                <td><span class="badge">${row.clicks}</span></td>
            </tr>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html lang="pl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Nowoczesny Skracacz Linków</title>
                <style>
                    :root {
                        --bg-color: #f4f6f9;
                        --card-bg: #ffffff;
                        --primary: #4f46e5;
                        --primary-hover: #4338ca;
                        --text-main: #1f2937;
                        --text-muted: #6b7280;
                        --border: #e5e7eb;
                        --danger: #ef4444;
                    }

                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
                    
                    body { background-color: var(--bg-color); color: var(--text-main); padding: 40px 20px; line-height: 1.5; }
                    
                    .container { max-width: 850px; margin: 0 auto; }
                    
                    header { text-align: center; margin-bottom: 30px; }
                    header h1 { font-size: 2rem; color: var(--text-main); font-weight: 700; margin-bottom: 8px; }
                    header p { color: var(--text-muted); }

                    .card { background: var(--card-bg); padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); margin-bottom: 30px; }
                    
                    .form-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 15px; }
                    
                    .form-group label { display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 6px; color: var(--text-main); }
                    
                    input[type="text"], input[type="url"] {
                        width: 100%;
                        padding: 12px 16px;
                        border: 1px solid var(--border);
                        border-radius: 8px;
                        font-size: 0.95rem;
                        transition: border-color 0.2s, box-shadow 0.2s;
                        outline: none;
                    }

                    input:focus {
                        border-color: var(--primary);
                        box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
                    }

                    button {
                        width: 100%;
                        padding: 12px 20px;
                        background-color: var(--primary);
                        color: white;
                        border: none;
                        border-radius: 8px;
                        font-size: 1rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: background-color 0.2s;
                    }

                    button:hover { background-color: var(--primary-hover); }

                    .alert-error { background-color: #fef2f2; border-left: 4px solid var(--danger); color: #991b1b; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 0.9rem; }

                    .table-wrapper { overflow-x: auto; }
                    
                    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; }
                    
                    th { background-color: #f9fafb; padding: 12px 16px; color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--border); }
                    
                    td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
                    
                    tr:last-child td { border-bottom: none; }

                    .url-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    .url-cell a { color: var(--text-muted); text-decoration: none; }
                    .url-cell a:hover { color: var(--text-main); text-decoration: underline; }

                    .short-link { color: var(--primary); font-weight: 600; text-decoration: none; }
                    .short-link:hover { text-decoration: underline; }

                    .badge { display: inline-block; background-color: #e0e7ff; color: #3730a3; font-weight: 700; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; }

                    /* RWD dla smartfonów */
                    @media (max-width: 640px) {
                        .form-grid { grid-template-columns: 1fr; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <header>
                        <h1>Skracacz Linków</h1>
                        <p>Wklej długi adres URL, aby stworzyć szybki i krótki odnośnik</p>
                    </header>

                    <div class="card">
                        ${req.query.error ? `<div class="alert-error">${req.query.error}</div>` : ''}

                        <form action="/shorten" method="POST">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label for="url">Długi adres URL</label>
                                    <input type="url" id="url" name="url" placeholder="https://bardzo-dlugi-adres.com/sciezka" required>
                                </div>
                                <div class="form-group">
                                    <label for="custom_alias">Własny alias (opcjonalnie)</label>
                                    <input type="text" id="custom_alias" name="custom_alias" placeholder="np. moj-link">
                                </div>
                            </div>
                            <button type="submit">Skróć link</button>
                        </form>
                    </div>

                    <div class="card">
                        <h2 style="font-size: 1.1rem; margin-bottom: 15px;">Wygenerowane linki</h2>
                        <div class="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Oryginalny URL</th>
                                        <th>Skrócony adres</th>
                                        <th>Kliknięcia</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml || '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Brak wygenerowanych linków.</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
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
    console.log(`Aplikacja została pomyślnie uruchomiona na porcie ${PORT}`);
});
