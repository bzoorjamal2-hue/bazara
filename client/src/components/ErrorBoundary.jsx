import { Component } from 'react';

// حاجز أخطاء.
//
// بلا حاجز، أيّ خطأ أثناء الرسم يجعل React يُفرغ الشجرة كلّها فتبقى خلفية
// الموقع الكريمية وحدها بلا محتوى ولا مخرج — وهو ما حدث فعلاً عند الانتقال
// بين الصفحات. الحاجز يحصر الضرر ويعطي الزائرة طريقاً للخروج بدل شاشةٍ ميتة.
//
// النصّ ثابت بالعربية لا عبر i18n عمداً: قد يكون سبب الانهيار نفسه في طبقة
// الترجمة، فاستدعاؤها هنا يُسقط الحاجز أيضاً.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, msg: '' };
  }

  static getDerivedStateFromError(error) {
    // نحتفظ بنصّ الخطأ لنعرضه: «حدث خطأ غير متوقّع» وحدها لا تُمكّن أحداً من
    // إصلاح شيء — لا صاحبة الموقع ولا من تراسله. السطر الواحد يكفي لتحديد
    // الملف والسبب، ولا يكشف بياناتِ أحد.
    return { failed: true, msg: String(error?.message || error || '').slice(0, 240) };
  }

  componentDidCatch(error, info) {
    console.error('واجهة: انهيار أثناء الرسم', error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center p-6" style={{ background: '#F4EDE2' }}>
        <div
          className="w-full max-w-sm rounded-3xl p-8 text-center"
          style={{ background: '#ffffff', boxShadow: '0 18px 48px -18px rgba(94,70,54,0.45)', border: '1px solid rgba(176, 154, 126, 0.35)' }}
        >
          <span
            aria-hidden
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{ background: 'rgba(176, 154, 126, 0.15)', color: '#8a2438' }}
          >
            ⚠
          </span>
          <p className="font-display text-lg font-bold" style={{ color: '#5e4636' }}>تعذّر عرض هذه الصفحة</p>
          <p className="mt-1.5 text-sm" style={{ color: '#7a6f73' }}>
            حدث خطأ غير متوقّع. جرّبي تحديث الصفحة، وإن تكرّر فارجعي للرئيسية.
          </p>
          {this.state.msg && (
            <p
              dir="ltr"
              className="mt-3 max-h-24 overflow-auto rounded-xl px-3 py-2 text-start text-[11px] leading-relaxed"
              style={{ background: 'rgba(94,70,54,0.06)', color: '#6b6560', fontFamily: 'ui-monospace, monospace' }}
            >
              {this.state.msg}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full px-6 py-2.5 text-sm font-bold"
              style={{ background: 'linear-gradient(150deg, #3f2e22 0%, #241708 100%)', color: '#F4EDE2' }}
            >
              تحديث الصفحة
            </button>
            <a
              href="/"
              className="rounded-full px-5 py-2.5 text-sm font-bold"
              style={{ border: '1px solid rgba(94,70,54,0.3)', color: '#5e4636' }}
            >
              الرئيسية
            </a>
          </div>
        </div>
      </div>
    );
  }
}
