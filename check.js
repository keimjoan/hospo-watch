// Cloud-Pruefung (GitHub Actions): schaut ~4,5 Minuten lang alle 15 s nach freien Plaetzen und schickt einen ntfy-Alarm.
const BASE = 'https://www.buchsys.de/bremen/angebote/aktueller_zeitraum/';
const KURSE = (process.env.KURSE || '1541,1531,1532,1535').split(',');
const SEITE = process.env.SEITE || '_Volleyball.html';
const TOPIC = process.env.NTFY_TOPIC || '';
const MAX_S = Number(process.env.MAX_SECONDS || 270);
const POLL_S = Number(process.env.POLL_SECONDS || 15);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function pruefe() {
  const res = await fetch(BASE + SEITE, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const html = await res.text();
  const rows = html.split(/<tr class=/);
  return KURSE.filter((nr) => {
    const row = rows.find((r) => r.includes(`id="K${nr}"`));
    return row && row.includes('bs_btn_buchen');
  });
}

async function alarm(frei) {
  log('PLATZ FREI:', frei.join(', '));
  if (!TOPIC) return log('(kein NTFY_TOPIC gesetzt - kein Alarm gesendet)');
  await fetch('https://ntfy.sh/' + TOPIC, {
    method: 'POST',
    headers: { Title: 'Volleyball: Platz frei!', Priority: 'urgent', Tags: 'rotating_light,volleyball',
      Click: BASE + SEITE },
    body: `Kurs ${frei.join(', ')} ist buchbar! Jetzt buchen.`,
  });
}

(async () => {
  const ende = Date.now() + MAX_S * 1000;
  let fehler = 0;
  while (Date.now() < ende) {
    try {
      const frei = await pruefe();
      if (frei.length) { await alarm(frei); return; } // ein Alarm pro Lauf; naechster Lauf in 5 Min erinnert erneut
      fehler = 0;
    } catch (e) { log('Fehler:', e.message); if (++fehler >= 10) process.exit(1); }
    await sleep(POLL_S * 1000);
  }
  log('Nichts frei.');
})();
