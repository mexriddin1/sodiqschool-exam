# test.sodiqschool.uz — test-app'ni serverga chiqarish

Funnel sayti (`test-app`) uchun. Boshqa uchta yuza (backend, admin, client)
allaqachon shu serverda ishlayotgan bo'lsa, ularning hech biri to'xtatilmaydi
— faqat backend'ning CORS ro'yxati va bitta migratsiya yangilanadi.

| | |
| --- | --- |
| Domen | `test.sodiqschool.uz` |
| Server | `176.101.56.242` (Ubuntu 22.04) |
| Loyiha | `/opt/sodiq` — **`/opt/sodiq-school` BOSHQA loyiha, tegmang** |
| Ichki port | `3020` · pm2: `sodiq-test-app` |
| API | `https://api.natija.sodiqschool.uz` (backend, ichki port `4010`) |

Boshqa yuzalar shu serverda: `sodiq-backend` (4010), `sodiq-admin` (3010),
`sodiq-client` (4321) — mos ravishda `api.natija`, `admin.natija` va
`natija.sodiqschool.uz`.

## 0. DNS

```
test.sodiqschool.uz.   3600   IN   A   176.101.56.242
```

Tarqalganini tekshiring (sertifikat olishdan OLDIN — aks holda certbot
yiqiladi):

```bash
dig +short test.sodiqschool.uz          # 176.101.56.242 chiqishi kerak
```

## 1. Kodni olish va o'rnatish

```bash
cd /opt/sodiq
git pull origin main
npm install                          # root workspaces
cd test-app && npm install && cd ..  # test-app workspace EMAS
```

> `test-app` root `package.json` dagi `workspaces` ro'yxatiga **kirmaydi**,
> shuning uchun uning paketlari alohida o'rnatiladi.

## 2. Baza migratsiyasi (MAJBURIY)

Yangi migratsiya bor: `20260715150000_attempts_share_one_result`. Usiz
o'quvchi ikkinchi fanni topshirganda submit **500 xato** beradi
(`Unique constraint failed on the fields: (resultId)`).

```bash
cd /opt/sodiq/backend
npx prisma migrate deploy
npx prisma generate
```

Backend TypeScript'dan build qilinadi (pm2 `dist/src/index.js` ni ishga
tushiradi), ya'ni kod o'zgarsa qayta build shart:

```bash
cd /opt/sodiq
npm run build --workspace @sodiq/compute   # backend shunga bog'liq
npm run build --workspace backend
pm2 restart sodiq-backend
```

## 3. Backend — CORS

`backend/.env` da `CORS_ORIGINS` ga yangi domen **qo'shilishi shart**. Usiz
brauzer test-app'ning har bir so'rovini bloklaydi va sahifa bo'sh qoladi.

```dotenv
CORS_ORIGINS=https://admin.natija.sodiqschool.uz,https://natija.sodiqschool.uz,https://admin.sodiqschool.uz,https://sodiqschool.uz,https://test.sodiqschool.uz
```

So'ng backend'ni qayta ishga tushiring (`pm2 restart backend` yoki
`systemctl restart sodiq-backend`).

## 4. test-app — sozlama va build

`test-app/.env`:

```dotenv
NEXT_PUBLIC_API_URL=https://api.natija.sodiqschool.uz
```

> **Diqqat:** `NEXT_PUBLIC_*` o'zgaruvchilari **build vaqtida** kodga
> singdiriladi. Ya'ni `.env` ni build'dan **keyin** o'zgartirsangiz, hech
> narsa o'zgarmaydi — qayta build qilish kerak.

```bash
cd test-app
npm run build
```

## 5. Ishga tushirish (pm2)

```bash
cd /opt/sodiq/test-app
pm2 start npm --name sodiq-test-app -- start     # `next start -p 3020`
pm2 save
```

systemd afzal bo'lsa — `/etc/systemd/system/sodiq-test-app.service`:

```ini
[Unit]
Description=Sodiq School test-app (funnel)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/sodiq/test-app
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now sodiq-test-app
```

## 6. Nginx

`/etc/nginx/sites-available/test.sodiqschool.uz`:

```nginx
server {
    listen 80;
    server_name test.sodiqschool.uz;

    location / {
        proxy_pass http://127.0.0.1:3020;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Savol rasmlari data-URL sifatida JSON ichida keladi — javob katta
    # bo'lishi mumkin.
    client_max_body_size 10m;
}
```

```bash
ln -s /etc/nginx/sites-available/test.sodiqschool.uz /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d test.sodiqschool.uz
```

## 7. Tekshirish

```bash
curl -I https://test.sodiqschool.uz              # 200
```

So'ng brauzerda: forma to'ldiriladi → testlar ro'yxati ochiladi →
matematika ochiq, ingliz va tanqidiy **qulflangan** bo'lishi kerak.

Brauzer konsolida CORS xatosi chiqsa — 3-qadam bajarilmagan.

## Serverda seed haqida

```bash
npm run seed --workspace backend        # admin + imtihon + shablonlar
```

`seed:mock` ni serverda **ISHLATMANG** — u demo o'quvchilar va soxta savolli
testlar yaratadi, va ishga tushganda mavjud leadlar, urinishlar va testlarni
o'chiradi. Haqiqiy testlarni admin paneldan qo'shasiz.

## Bilib qo'yish kerak

- **Tartib faqat interfeysda.** `/api/test-taking/attempts` ga to'g'ridan-
  to'g'ri so'rov yuborib istalgan testni boshlash mumkin. Funnel lead yig'ish
  uchun — nazorat ostidagi imtihon emas, shuning uchun ataylab shunday.
- **`/api/test-taking` da rate limiter yo'q.** Ochiq endpoint; kerak bo'lsa
  nginx darajasida cheklang (`limit_req`).
- **`leadId` URL'da ochiq turadi** (`/tests?lead=<uuid>`) — havolaga ega
  odam lead nomini ko'radi va uning nomidan test boshlay oladi.
- Hisobot **uchala fan** topshirilgandan keyingina nashr etiladi; chala
  natijada o'quvchi "Hisobot hali tayyor emas" sahifasini ko'radi.
