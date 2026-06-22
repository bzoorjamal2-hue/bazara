# 📱 دليل بناء ونشر تطبيق Bazara Store

التطبيق مبنيّ بـ **Capacitor** ويحمّل الموقع الحيّ (`bazarastore.site`).
ميزة مهمة: **أي تعديل تنشره على الموقع يظهر بالتطبيق تلقائياً** (لأنه يحمّل الموقع مباشرة) —
ما بتحتاج تعيد بناء التطبيق إلا لو غيّرت الأيقونة أو أضفت ميزة أصلية.

- معرّف التطبيق: `com.bazara.store`
- الاسم: `Bazara Store`

---

## 🤖 أندرويد (Google Play) — من جهاز Windows

### مرة واحدة: التجهيز
1. نزّل وثبّت **Android Studio**: https://developer.android.com/studio
2. افتحه أول مرة ودعه ينزّل الـ SDK تلقائياً.
3. ثبّت **Java JDK 17** (يجي مع Android Studio عادةً).

### فتح المشروع وبنائه
من مجلد `client`:
```
npm install
npm run build
npx cap sync android
npx cap open android
```
آخر أمر بيفتح Android Studio على المشروع.

### تجربة التطبيق
- وصّل جوال أندرويد بكيبل (فعّل Developer Mode + USB Debugging) أو شغّل محاكي.
- اضغط زر ▶️ Run في Android Studio.

### بناء ملف النشر (AAB) للمتجر
1. في Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle**
2. أنشئ **Keystore** جديد (احفظه + كلمة سره بأمان — تحتاجه لكل تحديث مستقبلي!)
3. اختر **release** → ينتج ملف `.aab`

### النشر على Google Play
1. أنشئ حساب: https://play.google.com/console (**25$ مرة واحدة**)
2. Create app → عبّي الاسم والوصف واللغة
3. ارفع ملف `.aab`
4. عبّي: لقطات شاشة، أيقونة 512×512، وصف، سياسة خصوصية (رابط)، تصنيف المحتوى
5. أرسل للمراجعة (عادةً يوم–٣ أيام)

---

## 🍎 آيفون (App Store) — بناء سحابي من الويندوز (بدون ماك)

✅ ما تحتاج ماك. نستخدم **Codemagic** (يبني على ماك سحابي ويرفع لمتجر آبل).
ملف الإعداد جاهز بجذر المشروع: `codemagic.yaml`.

### تجهيز لمرة واحدة
1. اشترك في **Apple Developer Program**: https://developer.apple.com (**99$/سنة**)
2. في https://appstoreconnect.apple.com:
   - **Users and Access → Integrations → App Store Connect API** → أنشئ مفتاحاً، واحفظ:
     Issuer ID + Key ID + ملف `.p8`
   - أنشئ التطبيق (Bundle ID: `com.bazara.store`) وخذ **رقم Apple ID** للتطبيق.
3. في https://codemagic.io (سجّل بحساب GitHub):
   - اربط ريبو `bzoorjamal2-hue/bazara`.
   - **Teams → Integrations → App Store Connect** → أضف المفتاح، وسمِّه بالضبط: `BazaraAppStore`
4. في `codemagic.yaml` بدّل `APP_STORE_APP_ID: 0000000000` برقم Apple ID الحقيقي للتطبيق.

### كل بناء (من الويندوز)
- ادخل https://codemagic.io → التطبيق → **Start new build** → اختر workflow `Bazara iOS — App Store`.
- ينتج `.ipa` ويرفعه تلقائياً لـ **TestFlight** للتجربة.
- لما تبي ترسل للمراجعة النهائية: فعّل `submit_to_app_store: true` في `codemagic.yaml` (أو أرسلها يدوياً من App Store Connect).
- أول مرة: عبّي معلومات التطبيق، لقطات الشاشة، الوصف، سياسة الخصوصية في App Store Connect ثم **Submit for Review** (المراجعة عادةً ١–٣ أيام).

> ⚠️ ملاحظة Apple (Guideline 4.2): قد ترفض التطبيق لو اعتبرته "مجرد موقع مغلّف".
> ✅ أضفنا ميزة أصلية: **إشعارات Push عبر APNs** (إعدادها تحت) — تقلّل خطر الرفض.

---

## 🔔 إشعارات Push الأصلية (APNs) — إعداد لمرة واحدة

الكود جاهز (إضافة `@capacitor/push-notifications` + صلاحية Push في مشروع iOS +
استقبال التوكن بالخادم). ينقص فقط مفتاح آبل ليبدأ الإرسال — يبقى نائماً بهدوء قبله.

بعد شراء حساب المطوّر:
1. في [Apple Developer](https://developer.apple.com) → Certificates, Identifiers & Profiles:
   - **Identifiers** → افتح `com.bazara.store` → فعّل **Push Notifications**.
   - **Keys** → أنشئ مفتاح **APNs** (نوع Apple Push Notifications service) → نزّل ملف `.p8` (مرة واحدة!) واحفظ **Key ID** و**Team ID**.
2. على Render أضف متغيّرات البيئة:
   ```
   APNS_KEY        = (محتوى ملف .p8 كامل، بسطوره)
   APNS_KEY_ID     = (الـ Key ID — 10 أحرف)
   APNS_TEAM_ID    = (الـ Team ID — 10 أحرف)
   APNS_TOPIC      = com.bazara.store
   APNS_PRODUCTION = true
   ```
3. خلاص — أول طلب جديد يوصل صاحب المتجر إشعار على الآيفون. (زر الجرس 🔔 في التطبيق يفعّل الإذن.)

> ملاحظة: نظام إشعارات الويب (PWA على المتصفّح) مستقل ويظل يعمل عبر مفاتيح VAPID.

> ⚠️ ملاحظة Apple: قد ترفض التطبيق إذا اعتبرته "مجرد موقع مغلّف" (Guideline 4.2).
> لتقليل الخطر نضيف ميزة أصلية مثل **إشعارات Push** — أخبرني وقتها لأضيفها.

---

## 🔄 تحديث التطبيق لاحقاً
- **تعديلات الموقع (واجهة/منطق):** انشرها عادي (git push) → تظهر بالتطبيق فوراً، بلا إعادة بناء.
- **تغيير الأيقونة/شاشة البداية:** عدّل `assets/icon.png` و`assets/splash.png` ثم:
  ```
  npx @capacitor/assets generate --iconBackgroundColor '#5C1A2E' --splashBackgroundColor '#5C1A2E'
  ```
- **تحديث نسخة على المتجر:** ارفع `.aab`/Archive جديد برقم إصدار أعلى.
