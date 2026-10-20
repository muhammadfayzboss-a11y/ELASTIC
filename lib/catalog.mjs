const rows = {
  fruit: [
    ["Olma", "Apple", "Яблоко"], ["Nok", "Pear", "Груша"],
    ["Banan", "Banana", "Банан"], ["Apelsin", "Orange", "Апельсин"],
    ["Mandarin", "Mandarin", "Мандарин"], ["Limon", "Lemon", "Лимон"],
    ["Uzum", "Grapes", "Виноград"], ["Anor", "Pomegranate", "Гранат"],
    ["Shaftoli", "Peach", "Персик"], ["O‘rik", "Apricot", "Абрикос"],
    ["Olxo‘ri", "Plum", "Слива"], ["Gilos", "Sweet cherry", "Черешня"],
    ["Olcha", "Sour cherry", "Вишня"], ["Qulupnay", "Strawberry", "Клубника"],
    ["Tarvuz", "Watermelon", "Арбуз"], ["Qovun", "Melon", "Дыня"],
    ["Kivi", "Kiwi", "Киви"], ["Xurmo", "Persimmon", "Хурма"],
    ["Behi", "Quince", "Айва"], ["Anjir", "Fig", "Инжир"]
  ],
  vegetable: [
    ["Kartoshka", "Potato", "Картофель"], ["Piyoz", "Onion", "Лук"],
    ["Sabzi", "Carrot", "Морковь"], ["Pomidor", "Tomato", "Помидор"],
    ["Bodring", "Cucumber", "Огурец"], ["Karam", "Cabbage", "Капуста"],
    ["Sarimsoq", "Garlic", "Чеснок"], ["Bulg‘or qalampiri", "Bell pepper", "Болгарский перец"],
    ["Achchiq qalampir", "Chili pepper", "Острый перец"], ["Baqlajon", "Eggplant", "Баклажан"],
    ["Qovoq", "Pumpkin", "Тыква"], ["Lavlagi", "Beetroot", "Свёкла"],
    ["Turp", "Radish (large)", "Редька"], ["Rediska", "Radish", "Редис"],
    ["Gulkaram", "Cauliflower", "Цветная капуста"], ["Brokkoli", "Broccoli", "Брокколи"],
    ["Kabachki", "Zucchini", "Кабачок"], ["Makkajo‘xori", "Sweet corn", "Кукуруза (овощ)"],
    ["Ko‘k piyoz", "Spring onion", "Зелёный лук"], ["Ko‘katlar (ukrop, kashnich, petrushka)", "Herbs (dill, coriander, parsley)", "Зелень (укроп, кинза, петрушка)"]
  ],
  grain: [
    ["Guruch", "Rice", "Рис"], ["Bug‘doy", "Wheat", "Пшеница"],
    ["Makkajo‘xori", "Corn grain", "Кукуруза (зерно)"], ["Grechka", "Buckwheat", "Гречка"],
    ["Suli yormasi", "Oatmeal", "Овсяная крупа"], ["Arpa yormasi", "Barley groats", "Ячневая крупа"],
    ["Manna yormasi", "Semolina", "Манная крупа"], ["Tariq", "Millet", "Пшено"],
    ["Perlovka", "Pearl barley", "Перловка"], ["Bulgur", "Bulgur", "Булгур"]
  ]
};
export const catalog = Object.entries(rows).flatMap(([category, items]) =>
  items.map(([uz, en, ru], index) => ({
    key: `${category}-${index + 1}`, category, name_uz: uz, name_en: en, name_ru: ru, unit: "kg"
  }))
);
