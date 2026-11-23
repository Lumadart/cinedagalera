// Tudo que formata ou converte datas, num lugar só.

/** Tempo relativo curto: "há 5 min", "há 3 h", "há 2 d". */
export function haQuanto(iso) {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const min = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return `há ${Math.round(min / 1440)} d`;
}

/** "qua, 18 de nov., 22:17" */
export function dataLonga(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}

/** "em 3 dias", "amanhã", "hoje às 20:00", "já começou". */
export function contagem(iso) {
  const t = new Date(iso).getTime();
  if (!t) return '';
  const ms = t - Date.now();
  if (ms <= 0) return 'já começou';
  const min = Math.round(ms / 60000);
  if (min < 60) return `começa em ${min} min`;
  const hh = Math.round(min / 60);
  if (hh < 24) return `começa em ${hh} h`;
  const dias = Math.round(hh / 24);
  return dias === 1 ? 'começa amanhã' : `começa em ${dias} dias`;
}

export const jaComecou = (e) => new Date(e.inicio).getTime() <= Date.now();

/** "sex., 20:00" */
export function horaCurta(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('.', '');
}

/** "15/11/26 22:30" ou "nunca". */
export function dataCurta(iso) {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  return isNaN(d) ? 'nunca' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** ISO → valor de <input type="datetime-local"> (hora local). */
export function paraLocal(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> → ISO (ou vazio). */
export const paraIso = (v) => (v ? new Date(v).toISOString() : '');
