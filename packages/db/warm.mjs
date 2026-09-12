import pg from 'pg';
const t0 = Date.now();
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
const r = await pool.query('select postgis_version() as v, count(*)::int as n from information_schema.tables where table_schema=$1', ['public']);
console.log('connect+query ms:', Date.now() - t0, JSON.stringify(r.rows[0]));
await pool.end();
