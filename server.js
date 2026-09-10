const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Połączenie z bazą PostgreSQL na Render.com
const connectionString = process.env.DATABASE_URL || 'postgresql://skracacz_user:cS81Gp42bQUcew3NZIwQhPnnpTQaDLp0@dpg-dah5vt95efls738607vg-a.frankfurt-postgres.render.com/skracacz';

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

// Tworzenie tabeli w bazie danych
pool.query(`
    CREATE TABLE IF NOT EXISTS urls (
        id SERIAL PRIMARY KEY,
        original_url TEXT NOT NULL,
        short_code VARCHAR(255) UNIQUE NOT NULL,
        clicks INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`, (err) => {
    if (err) console.error('Błąd inicjalizacji bazy PostgreSQL:', err);
    else console.log('Połączono z bazą PostgreSQL i przygotowano tabelę.');
});

app.use(express.urlencoded({ extended: true }));

function generateRandomCode(length = 6) {
    return crypto.randomBytes(length).toString('base64url').substring(0, length);
}

// ------------------- ROUTY / ŚCIEŻKI -------------------

// 1. Zwykła strona główna (Zablokowana dla obcych)
app.get('/', (req, res) => {
    res.status(404).send('404 Not Found - Strona nie istnieje.');
});

// 2. TAJNY PANEL ADMINISTRATORA (Dostępny tylko dla Ciebie)
// Możesz zmienić '/1979admin' na własny tajny adres, np. '/moj-tajny-skracacz-99'
app.get('/admin-panel', async (req, res) => {
    const MY_DOMAIN = `${req.protocol}://${req.get('host')}`;

    try {
        const result = await pool.query('SELECT * FROM urls ORDER BY created_at DESC');
        const rows = result.rows;

        let rowsHtml = rows.map(row => `
            <tr>
                <td class="url-cell"><a href="${row.original_url}" target="_blank" rel="noopener">${row.original_url}</a></td>
                <td class="short-url-cell"><a href="${MY_DOMAIN}/${row.short_code}" target="_blank" class="short-link">${MY_DOMAIN}/${row.short_code}</a></td>
                <td><span class="badge">${row.clicks}</span></td>
            </tr>
        `).join('');

        res.send(`
            <!DOCTYPE html>
            <html lang="pl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Panel Administracyjny - Skracacz Linków</title>
                <style>
                    :root {
                        --bg-color: #f4f6f9;
                        --card-bg: #ffffff;
                        --primary: #018E45;
                        --primary-hover: #016e35;
                        --text-main: #1f2937;
                        --text-muted: #6b7280;
                        --border: #e5e7eb;
                        --danger: #ef4444;
                    }

                    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
                    
                    body { background-color: var(--bg-color); color: var(--text-main); padding: 40px 20px; line-height: 1.5; }
                    
                    .container { max-width: 850px; margin: 0 auto; }
                    
                    header { text-align: center; margin-bottom: 30px; }
                    header h1 { font-size: 2rem; color: var(--text-main); font-weight: 700; margin-bottom: 8px; }
                    header p { color: var(--text-muted); }

                    .card { background: var(--card-bg); padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); margin-bottom: 30px; }
                    
                    .form-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 15px; }
                    
                    .form-group label { display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 6px; }
                    
                    input[type="text"], input[type="url"] {
                        width: 100%;
                        padding: 12px 16px;
                        border: 1px solid var(--border);
                        border-radius: 8px;
                        font-size: 0.95rem;
                        outline: none;
                    }

                    input:focus {
                        border-color: var(--primary);
                        box-shadow: 0 0 0 3px rgba(1, 142, 69, 0.15);
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
                    
                    .url-cell { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                    .url-cell a { color: var(--text-muted); text-decoration: none; }
                    .url-cell a:hover { color: var(--text-main); text-decoration: underline; }

                    .short-link { color: var(--primary); font-weight: 600; text-decoration: none; }
                    .short-link:hover { text-decoration: underline; }

                    .badge { display: inline-block; background-color: #e6f4ed; color: #018E45; font-weight: 700; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; }

                    @media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }
                </style>
            </head>
            <body>
                <div class="container">
                    <header>
                        <h1>Twój Panel Skracacza</h1>
                        <p>Generuj bezpieczne linki i śledź kliknięcia</p>
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
                                        <th>Skrócony adres (.onrender.com)</th>
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
    } catch (err) {
        res.status(500).send('Błąd bazy danych');
    }
});

// 3. Tworzenie skróconego linku
app.post('/shorten', async (req, res) => {
    const originalUrl = req.body.url;
    let customAlias = req.body.custom_alias ? req.body.custom_alias.trim() : null;
    let shortCode = customAlias || generateRandomCode();

    try {
        await pool.query('INSERT INTO urls (original_url, short_code) VALUES ($1, $2)', [originalUrl, shortCode]);
        // Powrót do tajnego panelu po skróceniu linku
        res.redirect('/admin-panel');
    } catch (err) {
        if (err.code === '23505') {
            return res.redirect('/admin-panel?error=' + encodeURIComponent('Ten alias jest już zajęty! Wybierz inny.'));
        }
        res.redirect('/admin-panel?error=' + encodeURIComponent('Błąd podczas zapisywania linku.'));
    }
});

// 4. Publiczne przekierowanie ze skróconych kodów
app.get('/:code', async (req, res) => {
    const code = req.params.code;

    try {
        const result = await pool.query('SELECT * FROM urls WHERE short_code = $1', [code]);
        if (result.rows.length === 0) {
            return res.status(404).send('Nie znaleziono takiego linku!');
        }

        const row = result.rows[0];
        await pool.query('UPDATE urls SET clicks = clicks + 1 WHERE id = $1', [row.id]);
        res.redirect(row.original_url);
    } catch (err) {
        res.status(500).send('Błąd serwera');
    }
});

app.listen(PORT, () => {
    console.log(`Serwer uruchomiony na porcie ${PORT}`);
});
