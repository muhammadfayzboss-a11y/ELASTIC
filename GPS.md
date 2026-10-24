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

21 ta avtomatik test va xotiradagi test serverida brauzer sinovlari bajarildi. Haqiqiy telefon bilan do‘kon yonidagi GPS o‘lchovi alohida amaliy tekshiruvni talab qiladi.

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
mumkin. Bosh ekranga qo‘shishda «Open as Web App»ni o‘chirish Safari yorlig‘ini yaratadi.
Bu telefon ruxsatini chetlab o‘tmaydi: 100 m radius, GPS aniqligi va server tekshiruvlari saqlanadi.
Bu o‘zgarish iOS 26.6 tizim ruxsati xatosini dastur orqali tuzatildi degani emas.
Telefonning bloklangan ruxsatini sayt avtomatik yoqa olmaydi.
