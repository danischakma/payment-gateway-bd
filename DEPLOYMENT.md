# Render.com-এ ডেপ্লয় করার নির্দেশিকা

## পূর্বশর্ত
- GitHub অ্যাকাউন্ট
- Render.com অ্যাকাউন্ট (ফ্রি)

---

## ধাপ ১: GitHub-এ কোড আপলোড করুন

```bash
git init
git add .
git commit -m "Initial commit: Payment Gateway"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/payment-gateway.git
git push -u origin main
```

---

## ধাপ ২: Render-এ PostgreSQL Database তৈরি করুন

1. [render.com](https://render.com) → **Dashboard** → **New +** → **PostgreSQL**
2. নাম দিন: `payment-gateway-db`
3. **Free** প্ল্যান নির্বাচন করুন
4. **Create Database** ক্লিক করুন
5. তৈরি হলে **Internal Database URL** কপি করুন (`postgresql://...`)

---

## ধাপ ৩: Render-এ Web Service তৈরি করুন

1. **Dashboard** → **New +** → **Web Service**
2. GitHub repo সংযুক্ত করুন
3. নিম্নলিখিত সেটিংস দিন:

| সেটিং | মান |
|-------|-----|
| **Name** | `payment-gateway` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

---

## ধাপ ৪: Environment Variables সেট করুন

Render Web Service → **Environment** ট্যাব → নিম্নের ভেরিয়েবলগুলো যোগ করুন:

```
DATABASE_URL     = (ধাপ ২-তে পাওয়া Internal Database URL)
ADMIN_TOKEN      = (যেকোনো শক্তিশালী র্যান্ডম স্ট্রিং, যেমন: Xk9#mP2@vL7qR4)
BASE_URL         = https://YOUR-APP-NAME.onrender.com
ALLOWED_ORIGINS  = https://yoursite.infinityfreeapp.com,https://yourdomain.com
BKASH_NUMBER     = 01XXXXXXXXX
NAGAD_NUMBER     = 01XXXXXXXXX
```

---

## ধাপ ৫: Deploy করুন

1. **Create Web Service** ক্লিক করুন
2. ডেপ্লয় সম্পন্ন হলে URL পাবেন: `https://payment-gateway.onrender.com`
3. প্রথম লোডে ডেটাবেস টেবিল স্বয়ংক্রিয়ভাবে তৈরি হবে

---

## অন্য সাইটে Embed করার পদ্ধতি

আপনার ওয়েবসাইটে নিচের কোড যোগ করুন:

```html
<!-- পেমেন্ট বাটন যেখানে দেখাতে চান -->
<div data-pg-button
     data-pg-amount="500"
     data-pg-email="customer@email.com"
     data-pg-method="bkash"
     data-pg-mode="modal"
     data-pg-label="💳 এখনই পেমেন্ট করুন">
</div>

<!-- Render-এর URL দিয়ে embed.js লোড করুন -->
<script src="https://YOUR-APP-NAME.onrender.com/embed.js"></script>
```

### JavaScript দিয়ে নিজে খুলতে চাইলে:

```javascript
// মোডাল উইন্ডোতে
window.PaymentGateway.open('500', 'user@email.com', 'bkash');

// নতুন ট্যাবে
window.PaymentGateway.openTab('500', 'user@email.com', 'nagad');
```

---

## API ব্যবহারের উদাহরণ

### পেমেন্ট শুরু করুন
```bash
curl -X POST https://YOUR-APP.onrender.com/api/initiate \
  -H "Content-Type: application/json" \
  -d '{"amount": 500, "email": "customer@email.com", "payment_method": "bkash"}'
```

### অর্ডার স্ট্যাটাস চেক করুন
```bash
curl "https://YOUR-APP.onrender.com/api/order-status?order_id=ORD-230624-0001"
```

### ট্রানজেকশন ভেরিফাই করুন
```bash
curl -X POST https://YOUR-APP.onrender.com/api/verify-payment \
  -H "Content-Type: application/json" \
  -d '{"order_id": "ORD-230624-0001", "trx_id": "ABC123XY9Z"}'
```

### SMS Webhook (SMS Forwarder অ্যাপ থেকে)
```bash
curl -X POST https://YOUR-APP.onrender.com/api/webhook/sms \
  -H "Content-Type: application/json" \
  -d '{"message": "You have received Tk.500 from 01711XXXXXX. TrxID: ABC123XY9Z"}'
```

### অ্যাডমিন প্যানেল API
```bash
curl "https://YOUR-APP.onrender.com/api/admin/orders?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## গুরুত্বপূর্ণ নোট

- Render-এর ফ্রি tier-এ সার্ভার ১৫ মিনিট idle থাকলে sleep হয়। প্রথম রিকোয়েস্টে ৩০ সেকেন্ড সময় লাগতে পারে।
- প্রোডাকশনে ব্যবহারের আগে ADMIN_TOKEN অবশ্যই শক্তিশালী করুন।
- ALLOWED_ORIGINS সঠিকভাবে সেট না করলে CORS error আসতে পারে।
