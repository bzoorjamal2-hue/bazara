import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api, { getErrorMessage } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Select from '../../components/Select.jsx';
import { KeyIcon, ShieldIcon, BellIcon, CheckIcon, XIcon, LinkIcon } from '../../components/icons.jsx';
import { PageHead, SectionHead, Tip } from '../../components/FormField.jsx';

export default function AdminRequests() {
  const { t } = useTranslation();
  const [error, setError] = useState('');



  // طلبات الاشتراك المعلّقة — نقطة الوصول الوحيدة لها
  const [requests, setRequests] = useState(null);
  const [reqBusy, setReqBusy] = useState('');

  // أكواد التفعيل
  const [codes, setCodes] = useState(null);
  const [genPlan, setGenPlan] = useState('monthly');
  const [genCount, setGenCount] = useState(1);
  const [newCodes, setNewCodes] = useState([]);
  const [codeBusy, setCodeBusy] = useState(false);

  const loadCodes = useCallback(() => {
    api.get('/subscription/codes').then((r) => setCodes(r.data.codes)).catch((e) => setError(getErrorMessage(e)));
  }, []);

  const loadRequests = useCallback(() => {
    api.get('/subscription/requests').then((r) => setRequests(r.data.requests)).catch(() => setRequests([]));
  }, []);

  useEffect(() => {
    loadCodes();
    loadRequests();
  }, [loadCodes, loadRequests]);

  // قبول الطلب يفعّل الاشتراك فوراً، ورفضه يُبقي الحساب كما هو
  const decide = async (id, action) => {
    setReqBusy(id); setError('');
    try {
      await api.post(`/subscription/requests/${id}/${action}`);
      setRequests((prev) => prev.map((x) => (x.id === id ? { ...x, status: action === 'approve' ? 'approved' : 'rejected' } : x)));
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setReqBusy('');
    }
  };

  const generate = async (e) => {
    e.preventDefault();
    setError(''); setCodeBusy(true);
    try {
      const { data } = await api.post('/subscription/codes', { plan: genPlan, count: genCount });
      setNewCodes(data.codes);
      loadCodes();
    } catch (err) {
      setError(getErrorMessage(err, t('errors.generic')));
    } finally {
      setCodeBusy(false);
    }
  };

  const Alert = ({ ok, children }) =>
    children ? (
      <div className={`rounded-xl border px-4 py-2.5 text-sm ${ok ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-red-400/30 bg-red-500/10 text-red-200'}`}>{children}</div>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHead icon={<ShieldIcon className="h-6 w-6" />} title={t('admin.title')} hint={t('admin.hint')} />
      <Alert>{error}</Alert>

      {/* طلبات الاشتراك — بانر «طلبات معلّقة» بنظرة المدير كان يقود إلى هذه
          الصفحة وهي لا تعرض طلباً واحداً: مسارات الخادم كاملة بلا واجهة. */}
      {requests && requests.length > 0 && (
        <div className="dash-section glass space-y-4 p-5">
          <SectionHead icon={<BellIcon className="h-5 w-5" />} title={t('admin.requestsTitle')} desc={t('admin.requestsHint')} />
          <div className="space-y-2">
            {requests.map((r) => {
              const pending = r.status === 'pending';
              return (
                <div
                  key={r.id}
                  className={`rounded-xl border p-3 ${pending ? 'border-gold-400/40 bg-gold-400/[0.06]' : 'border-gold-400/12 bg-black/15'}`}
                >
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-stone-100">{r.storeName || r.userName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-stone-400">{r.userEmail}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-cream"
                      style={{ background: pending ? '#92400e' : r.status === 'approved' ? '#047857' : '#b91c1c' }}
                    >
                      {t(`admin.reqStatus.${r.status}`, r.status)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full border border-gold-400/20 px-2 py-0.5 text-stone-300">
                      {t('admin.plan')}: {t(`subscription.${r.plan}`, r.plan)}
                    </span>
                    {r.method && (
                      <span className="rounded-full border border-gold-400/20 px-2 py-0.5 text-stone-300">
                        {t('admin.method')}: {r.method}
                      </span>
                    )}
                    {/* رقم الحوالة: ما يتحقّق به المدير من الدفع قبل القبول */}
                    {r.reference && (
                      <span className="flex items-center gap-1 rounded-full border border-gold-400/20 px-2 py-0.5 text-stone-300">
                        {t('admin.reference')}: <b dir="ltr">{r.reference}</b>
                        <Tip text={t('admin.referenceTip')} />
                      </span>
                    )}
                    {r.storeSlug && (
                      <a
                        href={`/store/${r.storeSlug}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border border-gold-400/20 px-2 py-0.5 text-gold-300 hover:bg-gold-400/10"
                      >
                        <LinkIcon className="h-3 w-3" /> {t('admin.subStore')}
                      </a>
                    )}
                  </div>

                  {pending && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={reqBusy === r.id}
                        onClick={() => decide(r.id, 'approve')}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-cream disabled:opacity-50"
                        style={{ background: '#047857' }}
                      >
                        <CheckIcon className="h-3.5 w-3.5" /> {t('admin.approve')}
                      </button>
                      <button
                        type="button"
                        disabled={reqBusy === r.id}
                        onClick={() => decide(r.id, 'reject')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                      >
                        <XIcon className="h-3.5 w-3.5" /> {t('admin.reject')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* أكواد التفعيل */}
      <div className="glass space-y-4 p-5">
        <h2 className="flex items-center gap-1.5 font-display text-lg font-bold text-stone-100"><KeyIcon className="h-5 w-5" /> {t('admin.codesTitle')}</h2>
        <p className="text-xs text-stone-400">{t('admin.codesHint')}</p>
        <form onSubmit={generate} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">{t('admin.plan')}</label>
            <Select
              value={genPlan}
              onChange={setGenPlan}
              options={[
                { value: 'monthly', label: `${t('subscription.monthly')} ($25)` },
                { value: 'yearly', label: `${t('subscription.yearly')} ($250)` },
              ]}
            />
          </div>
          <div className="w-24">
            <label className="label">{t('admin.count')}</label>
            <input type="number" min="1" max="50" className="input" value={genCount} onChange={(e) => setGenCount(e.target.value)} />
          </div>
          <button type="submit" disabled={codeBusy} className="btn-primary">{codeBusy ? t('common.loading') : t('admin.generateCodes')}</button>
        </form>

        {newCodes.length > 0 && (
          <div className="rounded-xl border border-gold-400/30 bg-gold-400/5 p-3">
            <p className="mb-2 text-sm font-semibold text-gold-200">{t('admin.newCodes')}</p>
            <div className="flex flex-wrap gap-2">
              {/* bg-black/40 كانت تصير مربّعاً رمادياً داكناً بنصّ بنّي باهت بالوضع
                  النهاري — خلفية ذهبية شفّافة تعمل بالوضعين */}
              {newCodes.map((c) => (
                <code key={c} className="rounded-lg bg-gold-400/15 px-3 py-1.5 font-mono text-sm font-bold text-gold-200 ring-1 ring-gold-400/25" dir="ltr">{c}</code>
              ))}
            </div>
          </div>
        )}

        {/* قائمة الأكواد */}
        {codes === null ? <Spinner /> : codes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-gold-400/15 text-stone-400">
                <tr>
                  <th className="p-2 text-start font-medium">{t('admin.code')}</th>
                  <th className="p-2 text-start font-medium">{t('admin.plan')}</th>
                  <th className="p-2 text-start font-medium">{t('admin.status')}</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.code} className="border-b border-white/5 last:border-0">
                    <td className="p-2 font-mono text-gold-300" dir="ltr">{c.code}</td>
                    <td className="p-2 text-stone-300">{t(`subscription.${c.plan}`)}</td>
                    <td className="p-2">
                      <span className={`badge ${c.used ? 'bg-stone-600/40 text-stone-300' : 'bg-emerald-500/20 text-emerald-200'}`}>
                        {c.used ? `${t('admin.usedBadge')}${c.usedEmail ? ` · ${c.usedEmail}` : ''}` : t('admin.available')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
