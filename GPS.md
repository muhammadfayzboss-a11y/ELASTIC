# GPS va mahsulot almashtirish

- O‘quvchi uch savdo joyini xaritada belgilaydi; ustoz nuqtani tekshirib tasdiqlaydi.
- GPS yoqilganda, sahifa ochiq va faol bo‘lsa yaqinlashish kuzatiladi.
- Yangi o‘lchov (30 soniyagacha), aniqlik 50 m yoki yaxshi va masofa + aniqlik <= 100 m talab qilinadi. Noaniq chegarada do‘konga yaqinlashish so‘raladi.
- Har bir savdo joyi alohida saqlanadi. Uchalasidan yozuv kelgach topshirildi deb hisoblanadi.
- Narx yuborishda lokatsiya qayta olinadi; server radius va topshirish muddatini qayta tekshiradi.
- HTTPS va foydalanuvchi ruxsati kerak. HTTP manzilda GPS ishlamaydi. Sayt yopiq yoki fon rejimida kuzatish bajarilmaydi.
- Brauzer bergan koordinatalar apparat darajasidagi tashrif isboti emas; GPSni soxtalashtirishni to‘liq bartaraf etmaydi.
- GPS harakat tarixi yozilmaydi; faqat narx yuborilgan paytdagi o‘lchov saqlanadi.
- Mahsulot almashtirish so‘rovi ustoz panelida ko‘rinadi. Tasdiqqacha eski mahsulot o‘quvchida qoladi. Tasdiqlash paytida yangi mahsulot bo‘shligi qayta tekshiriladi. Rad etish/bekor qilish eski mahsulotga ta’sir qilmaydi.
- Eski hisoblar, biriktirishlar va narxlar o‘chirilmaydi. Baza v3 migratsiyasi qo‘shimcha jadvallar yaratadi.

21 ta avtomatik test va xotiradagi test serverida brauzer sinovlari bajarildi. Haqiqiy telefon bilan do‘kon yonidagi GPS o‘lchovi alohida amaliy tekshiruvni talab qiladi.
