# Financial Advisor Pro

تطبيق محلل الأسهم المتقدم - تحليل فني وأساسي للسوق السعودي والأمريكي

## المميزات

- 📊 تحليل فني متقدم للأسهم
- 🎯 رادار الفرص وماسح الأسهم
- 💼 إدارة المحفظة والمحفظة الافتراضية
- ⭐ قوائم المراقبة والتنبيهات
- 📈 رسوم بيانية تفاعلية متقدمة
- 🤖 بوت التداول الآلي
- 📰 أخبار السوق وتحليل المشاعر

## التثبيت والتشغيل

1. استنساخ المشروع:
```bash
git clone https://github.com/alisary1394-u/dfapro.git
cd dfapro
```

2. تثبيت الحزم:
```bash
npm install
```

3. تشغيل التطبيق:
```bash
npm run dev
```

التطبيق سيعمل على: `http://localhost:5174`

## التقنيات المستخدمة

- React 18
- Vite
- TailwindCSS
- Recharts & Lightweight Charts
- React Query
- React Router
- LocalStorage للبيانات المحلية

## البيانات

التطبيق يعمل بالكامل محليًا باستخدام `localStorage` لحفظ البيانات. جميع بيانات السوق محاكاة واقعية.

## النشر على GitHub Pages

تم تجهيز المشروع للعمل على GitHub Pages عبر GitHub Actions.

1. ارفع المشروع على GitHub وتأكد أن الفرع الرئيسي هو `main`.
2. من إعدادات المستودع:
	- ادخل إلى `Settings` ثم `Pages`.
	- في `Build and deployment` اختر `Source: GitHub Actions`.
3. بعد أي `push` على فرع `main` سيتم بناء المشروع ونشره تلقائيًا.

ملاحظات مهمة:

- التوجيه (Routing) مضبوط تلقائيًا على `HashRouter` أثناء نشر GitHub Pages لتجنب مشاكل صفحات 404 عند تحديث الصفحة.
- مسار التطبيق (`base path`) يتم ضبطه تلقائيًا حسب اسم المستودع.
