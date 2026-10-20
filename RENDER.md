# ELASTIC: Render va .uz domen

## 1. GitHub

`C:\Projects\MICRO` ichidagi kodni GitHub repository ildiziga yuklang.
`package.json`, `render.yaml`, `server.mjs`, `public/`, `lib/` bir darajada bo‘lsin.
`data/`, `backups/`, `.env`, SQLite bazasi, test login-parollarini yuklamang.
Bu paket real ma’lumotlar bazasini o‘z ichiga olmaydi; yangi hostingda yangi
ustoz hisobi ochiladi. Mahalliy hisoblar avtomatik ko‘chirilmaydi.

## 2. Render Blueprint orqali

Render Dashboard → New → Blueprint → repository’ni tanlang.
Render `render.yaml` faylini o‘qiydi. Resurslarni va to‘lovni tekshirib tasdiqlang.
Bu konfiguratsiya **0.5c-512mb pullik Web Service + 1 GB persistent disk** yaratadi.
SQLite uchun Free xizmatdagi vaqtinchalik fayl tizimidan foydalanmang.
Root Directory bo‘sh: repository ildizida `package.json` turishi kerak.

Qo‘lda Web Service yaratish uchun ham aynan shu sozlamalar ishlatiladi:

| Sozlama | Qiymat |
|---|---|
| Runtime | Node |
| Build Command | `npm run check` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Node versiyasi (`NODE_VERSION`) | `24` |
| `HOST` | `0.0.0.0` |
| `NODE_ENV` | `production` |
| `DATABASE_PATH` | `/var/data/micro.sqlite` |
| `BACKUP_PATH` | `/var/data/backups` |
| Disk mount path | `/var/data` |
| Disk size | `1 GB` |

`PORT`ni qo‘lda belgilamang, Render bergan port ishlatiladi.
Dastlab `PUBLIC_URL`ni kiritmasangiz, Render bergan haqiqiy `https://…onrender.com`
manzil avtomatik ishlatiladi. Service nomi va manzilini Render ko‘rsatadi.
Bir dona service instance ishlating; shu disk faqat shu instance uchun.

## 3. Birinchi ustoz hisobi

Service Live bo‘lgach, Render Logs’da bir martalik `/#setup=…` havolasi chiqadi.
Uni o‘zingiz ochib, ustoz login va parolini yarating. Havolani boshqalarga bermang.
`https://…onrender.com/healthz` tekshiruviga `{"status":"ok"}` qaytishi kerak.
Render’ga testlarimizdagi namuna foydalanuvchilar yuklanmaydi.

## 4. .uz domenni ulash

1. Domen registratoridan .uz domen oling yoki mavjud domeningizni ishlating.
2. Render → service → Settings → Custom Domains → Add Custom Domain.
3. Haqiqiy domeningizni yozing, masalan `sizning-domeningiz.uz` (bu faqat misol).
4. Registrator DNS panelida Render ko‘rsatgan yozuvlarni kiriting.
   `www` uchun CNAME nishoni — xizmatning haqiqiy `…onrender.com` hosti.
   Ildiz `@` uchun ALIAS/ANAME mavjud bo‘lsa shu host, aks holda Render
   ko‘rsatgan A yozuvi ishlatiladi. IP manzilni Render panelidan oling.
   Shu web hostga tegishli eski zid A/AAAA yozuvlarini tekshiring;
   pochta MX/TXT yozuvlarini o‘zgartirmang.
5. Render’da Verify bosing. DNS tasdiqlangach TLS/HTTPS avtomatik yoqiladi.
6. Render → Environment’da `PUBLIC_URL=https://HAQIQIY-DOMENINGIZ.uz`
   qilib saqlang va redeploy qiling. Yo‘l yoki `/#overview` qo‘shmang.
7. Keyin saytga shu asosiy domen orqali kiring: login, guruhga taklif va narx
   yuborishni tekshiring. `www` qo‘shilgan bo‘lsa Render asosiy domen tomon
   yo‘naltiradi. `PUBLIC_URL` o‘rnatilgach eski onrender hostiga kirish 403
   berishi mumkin; bu ruxsatlar tekshiruvining kutilgan natijasi.
8. Domen almashganda eski taklif havolalarining hostini yangi domen bilan
   almashtiring yoki yangi taklif havolalari yarating. Domenlar orasida sessiya
   cookie’si ko‘chmaydi, qayta login qiling.

Domen nomi band yoki bo‘shligi bu paketda tekshirilmagan.

## 5. Ma’lumotlarni saqlash

Baza `/var/data/micro.sqlite`da. Diskni yoki service’ni o‘chirmang.
Render Shell’da `npm run backup` izchil SQLite zaxirasini
`/var/data/backups/` ichiga saqlaydi. Zaxiralarni alohida xavfsiz joyga ham
ko‘chiring; ularni GitHub’ga joylamang. Qayta deploydan keyin hisoblar va
narxlar saqlanayotganini tekshiring. Baza migratsiyasi start paytida bajariladi;
build bosqichida disk talab qilinmaydi.

Rasmiy hujjatlar:
- https://render.com/docs/disks
- https://render.com/docs/custom-domains
- https://render.com/docs/configure-other-dns
- https://render.com/docs/node-version
- https://render.com/docs/blueprint-spec
