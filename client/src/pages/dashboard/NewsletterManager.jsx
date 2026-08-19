import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import { MailIcon, PhoneIcon } from '../../components/icons.jsx';
import { PageHead } from '../../components/FormField.jsx';

// مشتركو النشرة (مدير) — عرض وتصدير. لا حذف من هنا: الحذف يحتاج تأكيد الشخص نفسه،
// وإتاحته بضغطة تفتح باب مسح القائمة بالخطأ.
export default function NewsletterManager() {
  const { t } = useTranslation();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = () => {
    setError('');
    api.get('/site/newsletter')
      .then((r) => setList(r.data.subscribers || []))
      .catch((e) => setError(getErrorMessage(e)));
  };
  useEffect(load, []);

  // تصدير CSV: نغلّف كل قيمة بعلامتَي اقتباس ونضاعف أي اقتباس بداخلها، ونسبق القيم
  // التي تبدأ بـ = + - @ بفاصلة عليا — وإلا نفّذها إكسل كصيغة (حقن CSV).
  const csvCell = (v) => {
    const s = String(v ?? '');
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const exportCsv = () => {
    const rows = [['contact', 'kind', 'created_at'], ...(list || []).map((s) => [s.contact, s.kind, s.created_at])];
    const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n'); // BOM كي يقرأ إكسل العربية
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `bazara-newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-4 text-sm text-red-200">
        <p>{error}</p>
        <button type="button" onClick={load} className="btn-ghost mt-3 !px-4 !py-1.5 text-xs">{t('assistant.retry')}</button>
      </div>
    );
  }
  if (list === null) return <Spinner />;

  const term = q.trim().toLowerCase();
  const shown = term ? list.filter((s) => String(s.contact).toLowerCase().includes(term)) : list;
  const emails = list.filter((s) => s.kind === 'email').length;
  const phones = list.length - emails;

  return (
    <div className="space-y-5">
      <PageHead
        icon={<MailIcon className="h-6 w-6" />}
        title={t('admin.newsletter')}
        hint={t('admin.newsletterHint')}
        action={list.length > 0 ? <button onClick={exportCsv} className="btn-primary shrink-0 !py-2 text-sm">{t('admin.exportCsv')}</button> : null}
      />

      {list.length === 0 ? (
        <div className="glass p-10 text-center text-stone-400">{t('admin.newsletterEmpty')}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-wine/10 px-3 py-1.5 text-wine">{t('admin.newsletterTotal', { count: list.length })}</span>
            {emails > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-3 py-1.5 text-gold-200"><MailIcon className="h-3.5 w-3.5" /> {emails}</span>}
            {phones > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-emerald-300"><PhoneIcon className="h-3.5 w-3.5" /> {phones}</span>}
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('common.search')}
            className="input w-full sm:max-w-xs"
          />

          <div className="glass divide-y divide-white/5 overflow-hidden">
            {shown.length === 0 ? (
              <p className="p-6 text-center text-sm text-stone-400">{t('common.noResults')}</p>
            ) : (
              shown.map((s) => (
                <div key={s.contact} className="flex items-center gap-3 p-3.5">
                  <span className={s.kind === 'email' ? 'text-gold-200' : 'text-emerald-300'}>
                    {s.kind === 'email' ? <MailIcon className="h-4 w-4" /> : <PhoneIcon className="h-4 w-4" />}
                  </span>
                  <span dir="ltr" className="min-w-0 flex-1 truncate text-sm text-stone-100">{s.contact}</span>
                  <span className="shrink-0 text-xs text-stone-500">{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
