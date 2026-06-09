# 📱 دليل بناء ونشر تطبيق Bazara Store

التطبيق مبنيّ بـ **Capacitor** ويحمّل الموقع الحيّ (`bazara-alpha.vercel.app`).
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

## 🍎 آيفون (App Store) — يحتاج جهاز Mac

⚠️ بناء تطبيقات iOS **مستحيل على Windows**. تحتاج **Mac + Xcode**.
بدائل بدون Mac: خدمة Mac سحابي (MacinCloud) أو بناء سحابي (Codemagic / Ionic Appflow).

### على جهاز Mac
1. ثبّت **Xcode** من App Store.
2. من مجلد `client`:
```
npm install
npm run build
npx cap sync ios
npx cap open ios
```
3. في Xcode: اختر فريق التطوير (Apple ID)، عدّل الـ Bundle ID لو لزم.
4. وصّل آيفون أو استعمل المحاكي → اضغط ▶️ Run للتجربة.

### النشر على App Store
1. سجّل في **Apple Developer Program**: https://developer.apple.com (**99$/سنة**)
2. في Xcode: **Product → Archive** → **Distribute App → App Store Connect**
3. في https://appstoreconnect.apple.com: عبّي معلومات التطبيق، لقطات الشاشة، الوصف، سياسة الخصوصية
4. أرسل للمراجعة (عادةً ١–٣ أيام)

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
