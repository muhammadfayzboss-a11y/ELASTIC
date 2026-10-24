# GPS va mahsulot almashtirish

- O‘quvchi uch savdo joyini xaritada belgilaydi; ustoz nuqtani tekshirib tasdiqlaydi.
- GPS yoqilganda, sahifa ochiq va faol bo‘lsa yaqinlashish kuzatiladi.
- Yangi o‘lchov (30 soniyagacha), aniqlik 50 m yoki yaxshi va masofa <= 100 m talab qilinadi. Noaniq chegarada do‘konga yaqinlashish so‘raladi.
- Har bir savdo joyi alohida saqlanadi. Uchalasidan yozuv kelgach topshirildi deb hisoblanadi.
- Narx yuborishda lokatsiya qayta olinadi; server radius va topshirish muddatini qayta tekshiradi.
- HTTPS va foydalanuvchi ruxsati kerak. HTTP manzilda GPS ishlamaydi. Sayt yopiq yoki fon rejimida kuzatish bajarilmaydi.
- Brauzer bergan koordinatalar apparat darajasidagi tashrif isboti emas; GPSni soxtalashtirishni to‘liq bartaraf etmaydi.
- GPS harakat tarixi yozilmaydi; faqat narx yuborilgan paytdagi o‘lchov saqlanadi.
- Mahsulot almashtirish so‘rovi ustoz panelida ko‘rinadi. Tasdiqqacha eski mahsulot o‘quvchida qoladi. Tasdiqlash paytida yangi mahsulot bo‘shligi qayta tekshiriladi. Rad etish/bekor qilish eski mahsulotga ta’sir qilmaydi.
- Eski hisoblar, biriktirishlar va narxlar o‘chirilmaydi. Baza v3 migratsiyasi qo‘shimcha jadvallar yaratadi.

Loyihaning avtomatik testlari va xotiradagi test serverida brauzer sinovlari bajariladi. Haqiqiy telefon bilan do‘kon yonidagi GPS o‘lchovi alohida amaliy tekshiruvni talab qiladi.

## Geoapify

GEOAPIFY_API_KEY sozlangan bo‘lsa osm-bright-smooth xaritasi va manzil qidiruvi yoqiladi.
Kalit faqat server muhitida/.env da saqlanadi, GitHub va ZIP ichiga qo‘shilmaydi.
Brauzerdagi xarita va qidiruv API so‘rovlarida kalit ishlatiladi, shuning uchun
Geoapify kalitini https://elasticprice.uz/ Referer’i bilan cheklash kerak.
Qidirish faqat Qidirish/Enter bosilganda bajariladi; har harfga so‘rov yuborilmaydi.
Qidiruv O‘zbekiston manzillari uchun. Natijadagi nuqtani xaritada tekshirish mumkin.
Xarita yuklanishi muvaffaqiyatsiz bo‘lsa OpenStreetMap zaxira qatlami ochiladi.


## Bosh ekran ilovasida ruxsat rad etilishi

Bosh ekran ilovasining lokatsiya ruxsati Safari ruxsatidan farq qilishi mumkin.
Ruxsat rad etilganda kuzatuv tozalanadi; «GPS’ni qayta tekshirish» yangi so‘rov boshlaydi.
Narx shakli yopilmasdan yordamni ochish va qayta tekshirish mumkin.
Apple standalone holatida iPhone uchun alohida ko‘rsatma chiqadi.
Agar ruxsat oynasi umuman chiqmasa va Safari’da ishlasa, saytni Safari’da ishlatish
mumkin, lekin asosiy yo‘l bosh ekran ilovasining o‘zida ruxsatni tiklashdir.
Bu telefon ruxsatini chetlab o‘tmaydi: 100 m radius, GPS aniqligi va server tekshiruvlari saqlanadi.
Bu o‘zgarish iOS 26.6 tizim ruxsati xatosini dastur orqali tuzatildi degani emas.
Telefonning bloklangan ruxsatini sayt avtomatik yoqa olmaydi.

## Noaniq GPS va to‘xtab qolgan o‘lchovdan tiklanish

- `enableHighAccuracy: true`, `maximumAge: 0` so‘raladi. Bu brauzerga talab; telefon baribir taxminiy tarmoq lokatsiyasini qaytarishi mumkin.
- Aniq o‘lchov kelmay qolsa yoki 20 soniya yangilanmasa, faol sahifadagi kuzatuv qayta boshlanadi. Rad etilgan ruxsat avtomatik qayta so‘ralmaydi.
- 30 soniyadan eski, kelajakdagi, noto‘g‘ri yoki oldingi kuzatuvdan kech kelgan javoblar qabul qilinmaydi.
- Yangi aniq o‘lchov harakatni darhol aks ettiradi. Vaqtincha juda noaniq javob hali yangi bo‘lgan aniq o‘lchovni almashtirmaydi.
- Taxminiy koordinatada do‘kongacha aniq masofa ko‘rsatilmaydi: aniqlik va kutish holati ko‘rsatiladi. Noaniq o‘lchov narx saqlashga ruxsat bermaydi.
- Narx yuborish va «Hozirgi joyimni olish» aniq o‘lchovni 45 soniyagacha kutadi. Shakl yopilsa yoki sahifa yashirilsa, shu so‘rov bekor qilinadi.
- Sozlamalar yoki ekran qulfidan qaytilganda faqat foydalanuvchi avval yoqqan kuzatuv ayni guruhda tiklanadi. Dastlabki ochilishda avtomatik ruxsat so‘ralmaydi.
- Narx ochiqligi mahsulot tanlanganiga, davr va guruh holatiga ham bog‘liq. Manzil tanlanmaganida bir xil ogohlantirish ikki marta chiqmaydi.
- iPhone bosh ekranidagi ko‘rinish safe-area chegaralarini hisobga oladi.

2026-10-24 tekshiruvi: 220/220 avtomatik test, jumladan 31 ta GPS sinovi.
Brauzerda sun’iy GPS bilan ±10 560 m → ±8 m tiklanish, 1,1 km tashqarida
bloklanish, ruxsat rad etilishi/qayta tekshirish va narx saqlash tekshirildi.
Bu sun’iy sinov jismoniy iPhone yoki do‘kon yonidagi o‘lchov o‘rnini bosmaydi.
Sayt GPS uskunasini yoki iOS ruxsat tizimini dastur orqali tuzata olmaydi.

Rasmiy asos: https://www.w3.org/TR/geolocation/

## iPhone bosh ekranidagi birinchi ruxsat so‘rovi

Bosh ekran rejimida birinchi chaqiruv `getCurrentPosition()` bilan boshlanadi.
U «GPS tekshirish», xaritadagi «Hozirgi joyimni olish» yoki Sozlamalardagi
«Lokatsiyaga ruxsat berish» tugmasi bosilgan oqimda bevosita chaqiriladi.
Javobdan keyin zarur bo‘lsa `watchPosition()` aniq o‘lchovni/kuzatuvni davom ettiradi.
Safari va boshqa brauzerlarda mavjud ishlaydigan kuzatuv oqimi saqlangan.
Bu moslik o‘zgarishi; uning o‘zi iOS tizimidagi saqlangan rad javobini bekor qilmaydi.

- Sozlamalar → Web app va GPS bo‘limi guruhsiz ham lokatsiyani tekshiradi.
- Ruxsat oynasi ochiq paytda takroriy avtomatik so‘rov yuborilmaydi.
- `navigator.permissions.query()` natijasi so‘rovni to‘sish uchun ishlatilmaydi.
- Bekor qilingan so‘rovdan kech kelgan javob e’tiborga olinmaydi; SecurityError ham tozalanadi.
- Rad javobida ilova ichida qayta o‘rnatish va Apple ruxsatlarni tiklash ko‘rsatmasi bor.
- Qayta qo‘shishda «Open as Web App» yoqilgan qoladi. Serverdagi hisob va tarix saqlanadi.
- Oxirgi chora: Reset Location & Privacy barcha ilovalarning maxfiylik/lokatsiya
  ruxsatlarini tiklaydi, ularga qayta ruxsat berish kerak. Buni sayt avtomatik bajarmaydi.

Avtomatik sinovlar birinchi API chaqiruvi, ruxsat berilishi/rad etilishi, vaqt tugashi,
bekor qilish va tizim xatosini taqlid qiladi. Ular haqiqiy iOS ruxsat oynasining
chiqishini isbotlamaydi; bu foydalanuvchining iPhone’ida amaliy tasdiqni talab qiladi.
Apple ruxsatlarni tiklash yo‘riqnomasi: https://support.apple.com/en-us/102515
