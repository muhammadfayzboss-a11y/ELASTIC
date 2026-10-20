# ELASTIC — Narxlar kundaligi

Ustoz va o‘quvchilar uchun guruhlarga ajratilgan mahsulot narxlarini kuzatish sayti.
Interfeys, server, SQLite bazasi, testlar va zaxira nusxa olish vositasi birga berilgan.

**Yaratuvchi: Muhammadfayz**

### 1.1 yangilanishi

- Asosiy paneldagi guruhlar bo‘yicha yig‘ilgan mahsulotlar soni o‘rniga
  **topshirish darajasi (%)** ko‘rsatiladi. Bu faol guruhlarning joriy davrlarida
  topshirgan a’zolar sonining jami a’zoliklar soniga nisbatidir.
  Har bir guruh kartochkasida o‘sha guruhning mahsulotlari soni saqlanadi.
- Yuqori o‘ngdagi quyosh/oy tugmasi yoki Sozlamalar orqali **kun/tun rejimi**
  almashtiriladi. Tanlov shu brauzerda saqlanadi; sahifa qayta ochilganda ham ishlaydi.
- Mahsulot almashtirilganda **sabab majburiy**. Do‘konlarda yo‘qligi, savdodan
  chiqarilgani, mavsum tugagani yoki boshqa sabab tanlanadi.
  “Boshqa sabab” uchun 5–500 belgilik izoh talab qilinadi.
- Sabab va izoh eski mahsulotning mas’ullik davri, narx yozuvi tafsiloti,
  ustozning amallar jurnali va CSV eksportida saqlanadi.
- Mavjud baza birinchi ishga tushishda avtomatik v2 ga yangilanadi.
  Hisoblar, guruhlar, mahsulotlar va oldingi narxlar saqlanadi.
  Yangilanishdan oldingi almashtirishlarda sabab noma’lum bo‘lsa, “Sabab qayd etilmagan”
  deb ko‘rsatiladi; sabablar taxmin qilib to‘ldirilmaydi.

## Tez ishga tushirish

**Talab:** Node.js 24 yoki undan yangi versiya.
Qo‘shimcha paket o‘rnatish, `npm install` yoki alohida baza serveri kerak emas.

1. `C:\Projects\MICRO\START.bat` faylini ikki marta bosing.
2. Birinchi ishga tushganda terminalda `http://127.0.0.1:3000/#setup=...` ko‘rinishidagi **bir martalik havola** chiqadi.
3. Shu havolani brauzerda ochib, ustozning ismi, logini va parolini yarating.
4. Keyingi kirishlar: **http://127.0.0.1:3000**.

Terminal orqali:

```powershell
Set-Location C:\Projects\MICRO
npm start
```

Server ishlayotgan oynani ochiq qoldiring. To‘xtatish: `Ctrl+C`.
Bir martalik sozlash havolasini boshqalarga bermang. Server qayta ishga tushirilsa,
hali ustoz yaratilmagan bo‘lsa, yangi havola beriladi. Ustoz yaratilgach sozlash yopiladi.

Saytda tayyor umumiy login/parol yoki namuna hisoblar yo‘q.
Parol 10–128 belgidan, login 3–32 lotin harfi/raqam/nuqta/`_`/`-` dan iborat.

## Ustoz uchun

1. **Yangi guruh** → nomi va izohini kiriting.
2. Katalogdan mahsulotlarni tanlang. Barcha 50 tasini yoki **har kategoriyadan
   10 tadan — jami 30 ta** variantini bir bosishda tanlash mumkin.
3. **Taklif havolalari** → havola yarating. Ixtiyoriy tugash muddati va qo‘shilishlar
   limiti mavjud. Havolani nusxalab o‘quvchilarga yuboring.
4. **Vaqt jadvali** orqali narx kiritishni oching.
5. **A’zolar** bo‘limida kim mahsulot tanlagani va joriy davrda kim narx topshirganini ko‘ring.
6. **Narxlar tarixi**da o‘quvchi, mahsulot va sana bo‘yicha filtrlang.
   Yozuv tafsilotida barcha oldingi tuzatishlar ko‘rinadi.
7. **CSV yuklash** barcha tanlangan yozuvlarning barcha versiyalarini eksport qiladi.

Mahsulotni qo‘shimcha ravishda katalogdan yoki qo‘lda uch tilda qo‘shish mumkin.
O‘lchov birligi: kg, litr, dona yoki qadoq. Boshlang‘ich katalogda barcha mahsulotlar kg bilan.
Qadoq, nav yoki brend farq qilsa, yangi mahsulotning nomida aniq yozing.

Ustoz guruhdan a’zoni chiqarishi, uning unutilgan parolini almashtirishi,
bo‘sh mahsulotni yoki butun guruhni arxivlashi mumkin. Tarix saqlanadi.
Guruhni arxivdan tiklash mumkin. Mahsulot katalogdan qayta qo‘shilsa tiklanadi.

## O‘quvchi uchun

1. Ustozning taklif havolasini oching.
2. Ism, login va parol yarating. Qo‘shimcha tasdiqlash talab qilinmaydi.
   Avval hisobingiz bo‘lsa, **Kirish** orqali shu hisob bilan yangi guruhga qo‘shiling.
3. Bo‘sh mahsulotlardan bittasini tanlang.
4. Davr ochilganda **Narxlarni kiritish**ni bosing.
5. Korzinka, Havas yoki Mall va oddiy do‘kon narxlarini kiriting.
   Oddiy do‘konning nomi yoki manzilini yozing.
6. Topilmagan mahsulot uchun **Mavjud emas** belgilang; nol narx kiritmang.
7. Kerak bo‘lsa **Mahsulotni almashtirish** orqali boshqa bo‘sh mahsulotni tanlang,
   almashtirish sababini ko‘rsating va saqlang.

Bir foydalanuvchi bir nechta guruhga kirishi mumkin. Har bir guruhda bittadan
faol mahsulotga ega bo‘ladi. Guruhlar bir-biriga ta’sir qilmaydi.

## Muhim ishlash qoidalari

- 20 ta meva, 20 ta sabzavot va foydalanuvchi yuborgan 10 ta donli mahsulot —
  jami **50 ta**. Sabzavot va don kategoriyalaridagi makkajo‘xori alohida.
- Bir mahsulot bir guruhda faqat bitta faol egaga ega. Bir vaqtda tanlash
  server tranzaksiyasi va bazadagi noyob indeks bilan cheklanadi.
- Band mahsulot boshqa o‘quvchining bo‘sh mahsulotlar ro‘yxatida chiqmaydi.
- Mahsulot almashganda avvalgi mahsulot bo‘shaydi. Avvalgi mas’ullik davri va
  narxlari saqlanadi; yangi mas’ullik davri boshlanadi.
- Yangi mahsulotni band qilish amalga oshmasa, eski mahsulot o‘quvchida qoladi.
- Bir davr uchun narxni qayta saqlash yangi **versiya** yaratadi; eski qiymat
  ustidan yozilmaydi.
- Kuzatilgan sana mahsulot o‘quvchiga biriktirilgan kundan bugungacha bo‘lishi mumkin.
- Faqat ochiq davrda narx kiritish va tuzatish mumkin.
- O‘quvchi guruhdagi mahsulot bandligini va egasining ismini ko‘radi. Batafsil
  narxlar tarixi faqat uning o‘ziga va guruh ustoziga ko‘rinadi.
- Havola bekor qilinsa, mavjud a’zolarning hisoblari ishlashda davom etadi.
  Havolani bilgan odam uni boshqaga yubora oladi — uni faqat mo‘ljallangan a’zolarga ulashing.
- Guruhdan chiqarilgan a’zo amal qilayotgan taklif bilan qayta qo‘shilishi mumkin.
  Qayta qo‘shilishni to‘xtatish uchun avvalgi takliflarni ham bekor qiling.
- Arxivlangan guruhda o‘qish mumkin, yangi amallar yopiladi.
- Guruhga qo‘shilganlar soni mahsulotlar sonidan ko‘p bo‘lsa, ortiqcha a’zolar
  mahsulot bo‘shashini yoki ustoz yangi mahsulot qo‘shishini kutadi.

## Vaqt jadvali

Barcha vaqtlar **Toshkent (UTC+5)** bo‘yicha; bazada vaqtlar UTC bilan saqlanadi.

- **Qo‘lda:** belgilash va saqlash orqali ochiladi/yopiladi.
  Yopiq holatdan qayta ochish yangi davr yaratadi.
- **Bir martalik:** ochilish va yopilish sanasi/vaqti.
- **Har hafta:** hafta kuni, ochilish vaqti va ochiq turish muddati (1–168 soat).
  Har haftalik davrning narxlari alohida saqlanadi.

Vaqtga ruxsat serverda har bir so‘rovda hisoblanadi. Alohida cron yoki ochiq
brauzer kerak emas. Ochiq guruh sahifasi holatini har 30 soniyada yangilaydi;
ochiq shakl yuborilganda muddat serverda yana tekshiriladi.

Jadvalni almashtirish yangi davr yaratadi; eski yozuvlar tarixda qoladi.
Narxlar avtomatik internetdan yig‘ilmaydi — o‘quvchilar kiritadi.

## Telefon va internet orqali ishlatish

Sayt 390 px telefon va 1366 px noutbuk o‘lchamlarida tekshirilgan.
Standart `127.0.0.1` manzil faqat ishga tushirilgan kompyuterda ochiladi.
Telefon foydalanuvchilari uchun umumiy server manzili kerak.

Bir xil Wi-Fi tarmog‘ida sinash uchun kompyuteringizning haqiqiy IP manzilini
quyidagi **misol** o‘rniga yozing:

```powershell
$env:HOST = "0.0.0.0"
$env:PUBLIC_URL = "http://192.168.1.25:3000"
npm start
```

Telefon ham shu manzilni ochadi; taklif havolalari o‘sha manzil asosida yaratiladi.
Windows Firewall serverga kirishga ruxsat berishi kerak. `PUBLIC_URL` dagi
manzil bilan kirish manzili bir xil bo‘lsin.

Internetdagi doimiy foydalanish uchun Node.js 24+, doimiy disk, HTTPS domen
va reverse proxy bilan serverga joylashtiring:

```text
HOST=127.0.0.1
PORT=3000
PUBLIC_URL=https://sizning-domeningiz.uz
DATABASE_PATH=/persistent-data/micro.sqlite
```

Proxy tashqi `Host` sarlavhasini saqlashi kerak. `PUBLIC_URL` HTTPS bo‘lsa,
sessiya cookie’si `Secure` bo‘ladi. Serverni xizmat sifatida ishlating va
ma’lumotlar bazasining zaxira nusxalarini oling.

`.env.example` sozlamalar ro‘yxati. Uni `.env` deb saqlasangiz,
`node --env-file=.env server.mjs` bilan ishga tushiring. Oddiy `npm start`
operatsion tizimdagi muhit o‘zgaruvchilarini ishlatadi.

**Bu topshiriqda kod mahalliy papkaga berilgan. Internet hostingiga joylashtirilmagan.**

## Ma’lumotlar va zaxira nusxa

Asosiy baza: `data/micro.sqlite`. SQLite WAL va foreign key tekshiruvlari yoqilgan.
Bu papkani yo‘qotmang. Kodni yangilaganda `data/` papkasini saqlab qoling.

```powershell
npm run backup
```

`backups/` ichida vaqt belgisi bilan izchil `.sqlite` nusxa yaratiladi.
Bu amal server ishlayotgan paytda ham SQLite backup API orqali bajariladi.
Zaxiralarni alohida disk yoki xavfsiz saqlash joyida ham saqlang.

Tiklash: serverni to‘xtating, mavjud `data/` papkasini xavfsiz boshqa nom bilan
saqlang, yangi `data/` papkasiga zaxira faylni `micro.sqlite` nomida qo‘ying
va serverni qayta ishga tushiring. Eski WAL/SHM fayllarini tiklangan bazaga
aralashtirmang.

## Tuzilishi

```text
server.mjs             Ishga tushirish va sozlamalar
lib/app.mjs            HTTP API, ruxsatlar va amallar
lib/db.mjs             SQLite sxemasi va tranzaksiyalar
lib/security.mjs       Scrypt parollar, sessiya/taklif tokenlari
lib/schedule.mjs       Toshkent vaqtidagi davrlar
lib/catalog.mjs        50 ta mahsulotning uch tildagi katalogi
public/               Moslashuvchan HTML, CSS va JavaScript interfeys
tests/app.test.mjs     API va chegaraviy holatlar sinovlari
scripts/backup.mjs     SQLite zaxira nusxasi
START.bat              Windows uchun bir bosishda ishga tushirish
```

Asosiy jadvallar: users, sessions, groups, group_admins, memberships, products,
assignments, invites, schedules, periods, submissions, price_revisions, audit_events.
Narxlar kasr xatolaridan saqlanish uchun tiyin miqdorida butun son bilan saqlanadi.

## Tekshirish

```powershell
npm run check
npm test
```

Testlar haqiqiy foydalanuvchilar bazasini ishlatmaydi. Har bir API sinovi
alohida xotira bazasi va vaqtinchalik lokal portdan foydalanadi.

Parollar scrypt orqali xeshlanadi. Sessiya va taklif tokenlari bazada xesh
ko‘rinishida saqlanadi. Cookie `HttpOnly` va `SameSite=Lax`; o‘zgartiruvchi
API so‘rovlari aniq Origin va CSRF tokenini tekshiradi. Ro‘yxatdan o‘tish
va kirish urinishlariga tezlik cheklovi qo‘yilgan.

Hisobotda ko‘ringan namuna odamlar va narxlar faqat interfeys sinovi uchun
vaqtinchalik xotira bazasida ishlatilgan; tarqatiladigan loyihaga kiritilmagan.

## Render va .uz domen

Tayyor `render.yaml` va bosqichma-bosqich [RENDER.md](RENDER.md) qo‘llanmasi bor.
SQLite uchun pullik Web Service va doimiy disk kerak.
