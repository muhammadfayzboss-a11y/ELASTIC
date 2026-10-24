# ELASTIC — tekshiruv hisoboti

Sana: 2026-10-24 (Toshkent).

## Natija

Yakuniy lokal tekshiruv: **186 ta test, 186 tasi o‘tdi, 0 ta xato**.
`npm run check` ham muvaffaqiyatli bajarildi.
Testlar alohida xotira bazalari va vaqtinchalik fayllarda ishlaydi.

Dastlabki kengaytirilgan 169 ta testdan 12 tasi o‘tmadi. Bu 12 ta
alohida asosiy xato degani emas: ayrimlari bir xil muammoning chegara holatlari.
Quyidagi tuzatishlar avtomatik testlar, kod ko‘rigi va brauzer tekshiruvi asosida bajarildi.

## Topilgan va tuzatilgan muammolar

| Holat | Tuzatish va tekshiruv |
| --- | --- |
| Mahsulot almashtirilgach eski mahsulotning topshirilgan holati qolardi. | Joriy faol mahsulot hisoblanadi. Eski tarix saqlanadi. API testi va brauzerda tasdiqlash bilan tekshirildi. |
| GPS qo‘shilishidan oldingi uchta narxdan bittasini tuzatish topshirish holatini buzardi. | Eski to‘liq yozuv va keyingi tuzatish birga hisoblanadi. Regressiya testi qo‘shildi. |
| 300 dan ortiq lokatsiya yozuvi tasdiqlangan eski nuqtalarni javobdan chiqarib yuborardi. | Tasdiqlangan/kutilayotgan nuqtalar saqlanadi; har savdo joyining eng so‘nggi rad javobi ko‘rsatiladi. 305 ta rad etilgan yozuv bilan tekshirildi. |
| Tarixdagi kasrli sahifa raqami server xatosiga olib kelardi; noto‘g‘ri sana va kategoriya qabul qilinardi. | Sahifa butun musbat son bo‘lishi, sana haqiqiyligi va filtr oralig‘i tekshiriladi. Noto‘g‘ri qiymatlar 400 javobini oladi. |
| Qisman kiritilgan tarixda hali borilmagan savdo joyi «mahsulot yo‘q» sifatida ko‘rinardi. | Qayd etilgan savdo joylari tarix javobida qaytariladi va jadval «Hali kiritilmagan» holatini ajratadi. |
| GPS kutish davomida olingan nuqta eskirishi yoki noto‘g‘ri koordinata qaytishi mumkin edi. | Koordinata, vaqt va natijani qaytarish oldidan yangilik qayta tekshiriladi. 100 m radius va 50 m aniqlik chegaralari saqlanadi. |
| Xaritani dunyo chegarasidan surish 180° dan tashqaridagi uzunlikni berishi mumkin edi. | Leaflet tanlangan uzunlikni standart oraliqqa keltiradi. |
| Narx kiritilganda ustoz ro‘yxati avtomatik yangilanmasdi. | 30 soniyalik tekshiruv a’zolar, narxlar, mahsulotlar va davr o‘zgarishini ham kuzatadi. Ochiq shakllar tekshiruvni to‘xtatadi. |
| Guruhlar orasida tez o‘tilganda eski so‘rov umumiy holatni o‘zgartirishi mumkin edi. | Guruh ma’lumotlari barcha so‘rovlar tugab, sahifa hali mos bo‘lsa birgalikda qo‘llanadi. |
| GPS kutish paytida narx oynasi yopilsa yoki mahsulot o‘zgarsa kechikkan yuborish davom etishi mumkin edi. | Yuborishdan oldin shakl, guruh va mahsulot yana tekshiriladi. |
| Nginx ortida barcha foydalanuvchilar lokal server IP manzili bilan cheklanardi. | Faqat aniq yoqilgan mahalliy proksi uchun Nginx almashtiradigan X-Real-IP ishlatiladi. Tashqi yoki noto‘g‘ri sarlavhalarga ishonilmaydi. 8 ta chegara testi qo‘shildi. |
| A’zo chiqarilgach uning kutilayotgan so‘rovlari hisobda qolardi. | Mahsulot so‘rovi bekor qilinadi, kutilayotgan lokatsiya almashtirilgan deb belgilanadi; hisob faqat faol a’zolarni oladi. |

## Qamrov

- Kirish, taklif havolalari, sessiya, parol almashtirish va CSRF.
- Guruh, ustoz va o‘quvchi ruxsatlari; begona guruhga kirish cheklovlari.
- Mahsulotni band qilish, almashtirishni tasdiqlash/rad etish, bir vaqtdagi yozuvlar.
- Narx chegaralari, null qiymat, narx versiyalari, CSV, eski bazani ko‘chirish va zaxira.
- Har guruhning kiritmaganlar ro‘yxati, qisman/to‘liq topshirish, keyingi davr.
- Haftalik jadvalning yetti kuni va ochilish/yopilish chegaralari, Toshkent sanasi.
- GPS va 100 metr masofa, aniqlik, eski/kelajak vaqti va ruxsat rad javobi.
- Statik fayllar chegarasi, maxfiy fayllarga kirish va uch til kalitlarining to‘liqligi.

Brauzerda ustoz/o‘quvchi rollari, mahsulot almashtirish, eski tarix va sabab,
alohida guruhlar, uch til, kun/tun rejimi, xarita kattalashishi hamda 390×844
telefon o‘lchami tekshirildi. Tekshirilgan jarayonlarda JavaScript xatosi qayd etilmadi.

## Qayta bajarish

Node.js 24 bilan loyiha papkasida:

```sh
npm run check
npm test
```

Mahalliy Nginx proksisi ishlatilgandagina `TRUST_LOOPBACK_PROXY=1` yoqiladi.
Node tashqariga bevosita ochilgan bo‘lsa yoki proksi boshqa serverda bo‘lsa uni yoqmang.

## Tekshiruvning amaliy chegarasi

186 ta test 186 ta funksional/chegara holatini bildiradi; bu bir paytda 186 foydalanuvchi
bilan yuklama sinovi emas. Jismoniy telefon bilan do‘kon oldida GPS dala sinovi
o‘tkazilmadi. Qurilmaning joylashuv aniqligi va joylashuvni soxtalashtirish imkoniyati
brauzer hamda qurilmaga bog‘liq. Testlar barcha mumkin bo‘lgan xatolar yo‘qligiga
kafolat bermaydi; topilgan takrorlanadigan muammolar tuzatildi.
