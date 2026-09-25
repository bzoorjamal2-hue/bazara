# Bazara — App Review #2 submission pack (الإعلانات)

App ID: `1063634949367370` · Business: `695515553352363`
Login for Business config: `967328979728469`

هذه حزمة المراجعة الثانية — للأذون التي تفتح **المرحلة 3**: أن تُنشئ بازارا حملةً
مموّلةً على فيسبوك وإنستغرام نيابةً عن التاجرة، وأن تنشر منشوراً على حسابها.

المراجعة الأولى (الرسائل) ما زالت `Review in progress` منذ ١٣ أيلول ٢٠٢٦.
**لا تُقدَّم هذه المراجعة ولا يُلمَس إعداد التطبيق قبل أن تنتهي الأولى** — تقديمُ
طلبٍ ثانٍ فوق طلبٍ جارٍ يُعرّض الأوّل للتأخير أو للرفض.

---

## Part 0 — شروطٌ يجب أن تتحقّق **قبل** الضغط على Submit

المراجعون يفتحون الميزة ويجرّبونها بأنفسهم. طلبٌ يُقدَّم قبل أن تعمل الميزة فعلاً
يُرفض، والرفضُ يُطيل الدور. القائمة بالترتيب:

| # | الشرط | الحالة اليوم (٢٠ أيلول ٢٠٢٦) |
|---|---|---|
| 1 | المراجعة الأولى **مقبولة** | ⏳ `Review in progress` (اليوم السابع من ٢٠) |
| 2 | التطبيق **منشور** (Publish: Unpublished ← Live) | ❌ لا يجري إلّا بعد (1) |
| 3 | **حساب إعلاني فعّال** يُختبَر عليه | ❌ `bazara` (933076199874556) و`buss` كلاهما **موقوف: فشل الدفع** |
| 4 | ميزة النشر مبنيّةٌ وحيّةٌ على `bazarastore.site` | ❌ الطابور جاهز، والتوصيل بميتا لم يُبنَ بعد |
| 5 | حساب المراجِع يصل «مصنع الإعلانات» ويربط حساباً إعلانيّاً | ❌ يتبع (4) |

**الشرط (3) ليس على ميتا ولا علينا — هو عليك.** الحسابان موقوفان لأنّ ميتا لم
تستطع تحصيل وسيلة الدفع. وما دام الحساب موقوفاً فلا يمكن حتى **تجربة** الواجهة
البرمجيّة: نداء إنشاء حملةٍ على حسابٍ موقوفٍ يُرفَض. وإصلاحُه يفتحُ بابًا مهمّاً
مشروحاً في آخر هذه الورقة (تجربةٌ كاملةٌ قبل المراجعة).

---

## Part 1 — "Describe how your app uses this permission"

انسخ كل كتلة في حقل التبرير الخاص بإذنها.

---

### ads_management

```
Bazara is a multi-store marketplace used by small clothing, shoe and accessory
businesses in Palestine. Each store owner manages her own products, orders and Instagram
messages inside the Bazara dashboard.

The "Ad Studio" tab lets a store owner turn one of her own products into a paid
ad. Bazara writes the ad copy, renders the creative image in her browser from her
own product photo, and suggests an audience and a daily budget. She reviews and
edits everything, then presses "Publish".

At that point Bazara uses ads_management to create the campaign in the ad account
that she connected and that she owns:
- POST /act_{ad_account_id}/adimages to upload the creative she approved
- POST /act_{ad_account_id}/campaigns (objective, name, status)
- POST /act_{ad_account_id}/adsets (daily budget, schedule, targeting)
- POST /act_{ad_account_id}/adcreatives (the copy, the image, the link to her store)
- POST /act_{ad_account_id}/ads
- GET /act_{ad_account_id}/insights to show her the results inside Bazara
- POST to pause, resume or delete the ad when she asks

Every campaign is created PAUSED and the owner activates it herself after a final
review, so no money is ever spent without an explicit action by the person who
owns the ad account and its payment method.

Bazara never creates ads in an ad account the signed-in person does not
administer, never changes the payment method, and never spends from an account of
ours — the owner's own funding source pays for her own ads.

Without ads_management the store owner has to leave Bazara, open Ads Manager, and
retype the copy, re-upload the image and rebuild the audience by hand. That manual
gap is exactly what this feature removes for owners who are not marketers.
```

---

### ads_read

```
After a campaign is live, Bazara shows the store owner how it performed next to
the orders it produced — reach, impressions, clicks, and amount spent — inside the
same dashboard where she sees her sales.

We call GET /act_{ad_account_id}/insights and GET /{ad_id}/insights for the
campaigns that Bazara itself created in the ad account she connected, and we
display those numbers to her only.

This matters more than it sounds for our users: a small store owner who cannot see
what an ad returned will either keep spending blindly or stop advertising
altogether. We do not read insights for ad accounts she has not connected, we do
not aggregate data across stores, and we do not share it with anyone.

Without ads_read the owner can create an ad from Bazara but must open Ads Manager
to learn whether it worked.
```

---

### pages_manage_posts

```
Alongside paid ads, a store owner can publish the same piece to her own Facebook
Page as an ordinary post — the copy Bazara wrote and the image it rendered.

We call POST /{page-id}/photos with the image and the caption she approved, on the
Page she connected in the Bazara dashboard. She presses "Publish" for each post;
Bazara never posts on a schedule she did not set and never posts without her
pressing the button.

We also use the permission to delete a post from Bazara when she asks to remove
it, so she does not have to go to Facebook to undo something she started here.

Without pages_manage_posts she must download the image, open Facebook, upload it
and paste the caption by hand — the step where most small stores stop.
```

---

### instagram_content_publish

```
The same piece, published to the store owner's own Instagram Business account —
which is where our merchants' customers actually are.

We use the standard two-step publishing flow on the account she connected:
- POST /{ig-user-id}/media with image_url and the caption she approved
- POST /{ig-user-id}/media_publish with the resulting creation_id

The image is the creative she reviewed in Bazara's Ad Studio, hosted on our own
media host so that Instagram can fetch it.

Publishing happens only when she presses "Publish" on a campaign she prepared and
reviewed. Bazara does not publish to any account other than the one she connected,
and disconnecting the account in the Bazara dashboard removes our stored tokens
and ends our access.

Small fashion businesses in our market live on Instagram. Without
instagram_content_publish, Bazara can prepare a perfect post and still hand the
owner a file to upload by hand.
```

---

## Part 2 — الفيديو (screencast)

فيديو واحد يغطّي الأذون الأربعة. سجّله مرّةً وارفع الملف نفسه لكلّ إذن يطلبه.
٣–٤ دقائق، بلا قطع، ولا تتخطَّ خطوة — الخطوةُ الناقصةُ أشهرُ أسباب الرفض.

**السيناريو بالترتيب:**

1. افتح `https://bazarastore.site` وسجّل الدخول كصاحبة متجر.
2. افتح تبويب **«مصنع الإعلانات»**.
3. أظهِر حالة «لا حساب إعلاني مربوط»، ثمّ اضغط **«اربطي حسابك الإعلاني»**.
4. أظهِر نافذة Facebook Login for Business وشاشة الأذون كاملةً.
5. أظهِر قائمة الحسابات الإعلانية التي يديرها الشخص، واختر واحداً.
6. ارجع للوحة بازارا والحساب مربوطٌ باسمه ورقمه ظاهرَين.
7. اختر قطعةً من المتجر، واضغط **«ولّديلي الإعلان»**.
8. أظهِر النسخ الثلاث، اختر واحدةً وعدّل كلمةً فيها أمام الكاميرا.
9. أظهِر الصورة وهي تُرسَم، وبدّل القالب والمقاس.
10. أظهِر الجمهور والميزانية، وغيّر الميزانية اليوميّة.
11. اضغط **«انشري الحملة»** → أظهِر أنّها أُنشئت **موقوفةً (Paused)**.
12. افتح **Ads Manager** بتبويب آخر وأظهِر الحملة نفسها موجودةً هناك بنفس الاسم
    والميزانية والصورة — هذه هي اللقطة التي تُثبت `ads_management`.
13. ارجع لبازارا واضغط **«شغّلي الحملة»** ثمّ **«أوقفيها»** — أظهِر تغيّر الحالة.
14. أظهِر لوحة النتائج (الوصول/النقرات/المصروف) — تُثبت `ads_read`.
15. من نفس الحملة اضغط **«انشري كمنشور»** واختر فيسبوك → أظهِر المنشور على
    الصفحة فعلاً — تُثبت `pages_manage_posts`.
16. كرّرها لإنستغرام → أظهِر المنشور على الحساب — تُثبت `instagram_content_publish`.
17. أخيراً: اضغط **«افصلي الحساب الإعلاني»** وأظهِر أنّ الربط انتهى.

الخطوتان ١١ و١٧ هما ما يبحث عنه المراجع: أنّ المال لا يُصرَف بلا قرارها، وأنّ
بإمكانها سحبُ الإذن متى شاءت.

---

## Part 3 — Reviewer instructions

```
Test credentials:
  URL: https://bazarastore.site
  Email: <reviewer account email>
  Password: <reviewer account password>

The reviewer needs a Facebook account that administers at least one active ad
account and one Facebook Page with a linked Instagram Business account.

1. Sign in at https://bazarastore.site with the credentials above.
2. Open the "Ad Studio" tab in the store owner dashboard.
3. Press "Connect ad account". Facebook Login for Business opens.
4. Grant the requested permissions and choose an ad account, a Page and an
   Instagram account.
5. You return to the dashboard; the connected ad account is shown with options to
   change or disconnect it.
6. Pick any product from the store, choose a goal, and press "Write my ad".
7. Three ad variations appear. Choose one; edit the text freely.
8. The creative image is drawn in the browser. Change the template and the size.
9. Adjust the audience and the daily budget.
10. Press "Publish campaign". The campaign, ad set and ad are created in the
    connected ad account with status PAUSED. Bazara shows the campaign id.
11. Open Ads Manager for that ad account — the campaign is there with the same
    name, budget, targeting and creative.
12. Back in Bazara, press "Activate" and then "Pause" to change its status.
13. The results panel shows reach, clicks and spend for that campaign.
14. Use "Publish as post" to publish the same creative and caption to the
    connected Facebook Page, and to the connected Instagram account.
15. Press "Disconnect ad account" to revoke the connection. Stored tokens are
    deleted.

Notes:
- Every campaign Bazara creates is created PAUSED. Money is spent only after the
  owner activates it herself.
- Bazara never modifies the payment method of an ad account and never creates ads
  in an account the signed-in person does not administer.
- Access tokens are stored encrypted and are deleted on disconnect.
- Privacy policy: https://bazarastore.site/privacy
- Terms of service: https://bazarastore.site/terms
```

---

## Part 4 — Data handling

- الحملات والنتائج تُخزَّن في قاعدة بياناتنا (PostgreSQL) وتُعرَض لصاحبة المتجر
  التي أنشأتها وحدَها.
- رموز الوصول تُخزَّن **مشفَّرة**، وتُحذَف عند فصل الحساب.
- لا نبيع البيانات، ولا نشاركها مع طرفٍ ثالثٍ لأغراضٍ إعلانيّة، ولا نجمع نتائج
  متجرٍ لنعرضها لمتجرٍ آخر.
- لا نلمس وسيلة الدفع ولا نصرف من حسابٍ إعلانيٍّ نملكه نحن — كلُّ تاجرةٍ تدفع
  لإعلانها من حسابها.
- الحذف الكامل بطلبٍ بالبريد، ورابط حذف البيانات مسجَّلٌ في إعدادات التطبيق.

---

## Part 5 — ما سيعترضون عليه غالباً، والجواب جاهز

| الاعتراض المتوقّع | الجواب |
|---|---|
| «لماذا تحتاجون ads_management وليس boosted posts؟» | الترويج البسيط لا يسمح بجمهورٍ ولا ميزانيةٍ ولا نسخٍ متعدّدة، وتاجراتنا لسنَ مسوّقات — الميزة كلُّها أن يُبنى ذلك عنهنّ. |
| «هل تصرفون من حساب المستخدم بلا إذنه؟» | كلُّ حملةٍ تُنشَأ **موقوفة**، والتشغيل بيدها. الخطوة ١١ بالفيديو تُظهرها. |
| «أظهِروا فصلَ الحساب» | الخطوة ١٧. |
| «التطبيق غير منشور» | يُنشَر بعد المراجعة الأولى وقبل تقديم هذه. |
| «الحساب التجريبي لا يصل للميزة» | حساب المراجِع مشترِكٌ فعّال ويرى التبويب. |

---

## Part 6 — البابُ الذي يفتحه إصلاحُ الحساب الإعلانيّ (مهمّ)

الواجهة البرمجيّة للإعلانات لها **مستوى تطوير (Development Access)** قبل أيّ
مراجعة: يستطيع التطبيق أن ينشئ حملاتٍ في حسابٍ إعلانيٍّ **يديره مسؤول التطبيق
نفسه**. أي: ما إن يعود حسابُ `bazara` الإعلانيُّ فعّالاً حتى نستطيع أن نبنيَ
مجرى النشرِ كاملاً ونجرّبه من أوّله لآخرِه — بحملاتٍ **موقوفةٍ لا تصرفُ شيقلاً** —
**قبل المراجعة الثانية بشهر**.

وهذا يقلبُ ترتيبَ العمل: بدل أن نكتبَ ستّ مئة سطرٍ لا تُجرَّب وننتظرَ الموافقةَ
لنكتشفَ أخطاءها، نجرّبُها اليوم ونصلُ المراجعةَ بمجرًى مُختبَر. والمراجعُ نفسُه
يرى ميزةً تعمل لا وعداً.

**فالخطوة التالية الحقيقيّة ليست عندي — هي إصلاحُ وسيلةِ الدفعِ على الحساب
الإعلانيّ.** وهي خطوةٌ تخصُّك وحدَك: لا أُدخِلُ بياناتِ دفعٍ ولا أملكُ أن أفعل.

---

## Part 7 — ما تحقّق فعلاً بالتجربة (٢٠ أيلول ٢٠٢٦)

جُرِّب المجرى كاملاً على الحساب الإعلاني `3065099857016654` بتوكن مطوّر
(إعداد `Bazara Ads` = `1137738245589360`، وهو **منفصل** عن إعداد الرسائل
`967328979728469` الذي لم يُلمَس):

| الخطوة | النتيجة |
|---|---|
| `POST /act_X/adimages` — رفع الصورة بالبايتات | ✅ نجح |
| `POST /act_X/campaigns` | ✅ نجح (PAUSED) |
| `POST /act_X/adsets` — الجمهور والميزانية | ✅ نجح |
| `POST /act_X/adcreatives` | ✅ نجح |
| `POST /act_X/ads` | ❌ **«Ads creative post was created by an app that is in development mode. It must be in public to create this ad.»** |

**فالشرط الرابع في Part 0 يصير أدقّ:** نشرُ التطبيق (Unpublished ← Live) ليس
خطوةً تُؤجَّل لما بعد المراجعة — هو **شرطٌ لإنشاء الإعلان أصلاً**، حتى بمستوى
التطوير. الأربع نداءات الأولى تعمل بوضع التطوير، والخامس لا.

**حقولٌ كشفها النداء الحقيقي لا التوثيق** (مثبّتة بالكود):
- `is_adset_budget_sharing_enabled` مطلوب على **الحملة** لا المجموعة.
- `targeting_automation.advantage_audience` مطلوب صفراً أو واحداً.
- `min_daily_budget_imps` غير موجود؛ الصحيح `min_daily_budget`.

**تنبيه عند الاستئناف:** توكن المطوّر قصير العمر (ساعة إلى ساعتين). عند العودة
يُولَّد من جديد من نفس الإعداد `Bazara Ads` ويوضع في `server/.env`.
