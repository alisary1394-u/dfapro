# Financial Advisor Pro

تطبيق محلل الأسهم المتقدم - تحليل فني وأساسي للسوق السعودي والأمريكي

## المميزات

- 📊 تحليل فني متقدم للأسهم (RSI, MACD, Bollinger Bands, ATR, Ichimoku)
- 🕯️ اكتشاف نماذج الشموع تلقائياً (Hammer, Engulfing, Doji...)
- 📐 خطوط دعم ومقاومة تلقائية (Pivot S/R)
- 🎯 توزيع الحجم السعري (VPVR) ونقطة التحكم (POC)
- 🤖 تحليل فني ذكي بالذكاء الاصطناعي المحلي
- 💡 تقييم فني لحظي (شراء / محايد / بيع) في شريط الأدوات
- 💼 إدارة المحفظة والمحفظة الافتراضية
- ⭐ قوائم المراقبة والتنبيهات
- 📈 رسوم بيانية تفاعلية متقدمة
- 📰 أخبار السوق وتحليل المشاعر

---

## 🚀 التثبيت الأول

```bash
# 1. استنساخ المشروع
git clone https://github.com/alisary1394-u/dfapro.git
cd dfapro

# 2. تثبيت الحزم
npm install

# 3. تشغيل بيئة التطوير (Frontend + Backend معاً)
npm run dev
```

- **بيئة التطوير:** `http://localhost:5174`
- **السيرفر (الإنتاج):** `http://localhost:8080`

---

## 🔄 تحديث السيرفر المحلي بآخر التحديثات

### الطريقة الأسرع — أمر واحد فقط:

```bash
npm run update
```

هذا الأمر يقوم تلقائياً بـ:
1. ✅ سحب آخر التحديثات من GitHub (`git pull`)
2. ✅ تحديث الحزم (`npm install`)
3. ✅ إعادة بناء التطبيق (`npm run build`)
4. ✅ إيقاف السيرفر القديم
5. ✅ تشغيل السيرفر الجديد على `http://localhost:8080`

---

### الطريقة اليدوية — خطوة بخطوة:

```bash
# 1. سحب آخر التحديثات من GitHub
git pull origin main

# 2. تثبيت أي حزم جديدة
npm install

# 3. إعادة بناء التطبيق (يحدّث مجلد dist/)
npm run build

# 4. تشغيل السيرفر
npm start
# أو للتطوير مع Hot Reload:
npm run dev
```

---

### للتطوير بـ Hot Reload (الأفضل أثناء تعديل الكود):

```bash
# يشغّل السيرفر والـ Frontend معاً مع تحديث فوري عند التعديل
npm run dev
```

افتح `http://localhost:5174` — يتحدث فور حفظ أي ملف.

---

### إيقاف السيرفر:

```bash
npm run stop
# أو مباشرة:
bash stop.sh
```

---

## 📦 السكريبتات المتاحة

| الأمر | الوظيفة |
|-------|---------|
| `npm run dev` | تطوير محلي مع Hot Reload (Frontend + Backend) |
| `npm run build` | بناء التطبيق للإنتاج |
| `npm start` | تشغيل سيرفر الإنتاج فقط |
| `npm run update` | **تحديث كامل** — pull + install + build + restart |
| `npm run stop` | إيقاف السيرفر |
| `npm run lint` | فحص جودة الكود |

---

## 🐳 التشغيل بـ Docker

```bash
# بناء الصورة
docker build -t dfapro .

# تشغيل الحاوية
docker run -d -p 8080:8080 --name dfapro dfapro

# تحديث بعد سحب تحديثات جديدة
docker stop dfapro && docker rm dfapro
docker build -t dfapro . && docker run -d -p 8080:8080 --name dfapro dfapro
```

---

## 🔧 التقنيات المستخدمة

- **Frontend:** React 18 + Vite + TailwindCSS
- **Charts:** Lightweight Charts + Recharts
- **State:** React Query + Context API
- **Backend:** Node.js + Express
- **Storage:** localStorage (بيانات المستخدم) + Yahoo Finance API
