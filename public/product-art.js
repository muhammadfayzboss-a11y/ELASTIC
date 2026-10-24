// Local SVG illustrations render consistently without an operating-system emoji font.
const path = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" ${extra}/>`;
const ellipse = (cx, cy, rx, ry, fill, extra = "") => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
const circle = (cx, cy, r, fill) => ellipse(cx, cy, r, r, fill);
const line = (d, color = "#64864a", width = 2) => path(d, "none", `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`);
const leaf = (x = 32, y = 13) => path(`M${x} ${y}q5-12 17-7-3 12-17 7Z`, "#679a4c");
const stem = () => line("M31 17q-2-8 2-12", "#816245", 3);
const shine = (x, y) => ellipse(x, y, 3, 7, "#ffffff", 'opacity=".22" transform="rotate(25 '+x+' '+y+')"');
const roundFruit = (color, shape = "M32 18C12 7 5 29 13 46c6 13 13 10 19 9 6 1 13 4 19-9C59 29 52 7 32 18Z") => path(shape, color)+stem()+leaf()+shine(20,29);
const cherry = (sour = false) => line("M18 36Q20 9 39 9M43 35Q43 18 39 9", "#5b8544", 2.5)+leaf(30,12)+circle(18,43,11,sour?"#bd3142":"#9e2136")+circle(44,43,11,sour?"#db3f4e":"#bd2940")+shine(14,39)+shine(40,39);
const seeds = (color, type = "oval") => Array.from({length:15},(_,i)=>{
  const x=14+(i%5)*9+(Math.floor(i/5)%2)*2,y=26+Math.floor(i/5)*7;
  return type==="triangle" ? path(`M${x} ${y-3}l4 6h-8Z`,color) : ellipse(x,y,type==="long"?4:3,type==="long"?1.5:2.5,color,`transform="rotate(${i%2?25:-20} ${x} ${y})"`);
}).join("");
const bowl = (color, type = "oval") => ellipse(32,35,25,13,"#e2d7bc")+seeds(color,type)+path("M7 35q1 23 25 23t25-23q-24 12-50 0Z","#b5c3b9")+path("M12 39q5 14 18 14", "none", 'stroke="#e6ece7" stroke-width="3" stroke-linecap="round"');
const stalk = (color, oat = false) => line("M30 58V9M30 29l-12-9M30 39l13-10M30 48l-12-9", "#9c9c4c", 2.5)+[0,1,2,3].map(i=>ellipse(23,17+i*10,4,oat?7:5,color,'transform="rotate(-40 23 '+(17+i*10)+')"')+ellipse(37,12+i*10,4,oat?7:5,color,'transform="rotate(40 37 '+(12+i*10)+')"')).join("");
const cabbage = (color = "#7fac5e") => circle(32,36,23,color)+path("M31 57C7 42 17 18 31 19 13 35 31 51 31 57Z","#a1c67a")+path("M32 57c26-18 17-36 2-38 17 17 0 33-2 38Z","#5e954b")+line("M31 57V26M31 45L20 33M32 39l12-9","#d5e2ac",1.8);
const pepper = color => stem()+path("M32 21C12 8 4 30 14 51c5 8 12 5 18 3 6 2 13 5 18-3C60 30 52 8 32 21Z",color)+line("M25 23q-7 13 0 29M39 23q7 13 0 29", "#ffffff",1.2)+path("M19 19l11-6 14 7-13 7Z","#5d8e40");
const florets = (color, base) => path("M27 55V31h10v24Z",base)+line("M32 40 17 29M32 41l16-13",base,7)+[[16,27,11],[27,20,12],[41,21,11],[48,31,10],[29,32,14]].map(([x,y,r])=>circle(x,y,r,color)).join("")+line("M21 25l2-3M36 20l2-2M42 31l2-3",base,2);

const art = {
  "fruit-1":roundFruit("#cf4f4b"),
  "fruit-2":path("M29 18C22 17 24 30 16 36 1 54 20 62 34 58 51 58 59 45 44 32c-7-6-5-17-15-14Z","#a5b654")+stem()+leaf()+shine(19,44),
  "fruit-3":path("M11 15c-3 27 18 50 43 29-19 5-31-9-31-30Z","#edc452")+line("M15 16c0 23 15 37 33 30","#d69d31",2)+path("M10 13h14v6H10Z","#8e7646"),
  "fruit-4":circle(32,36,23,"#e79c3e")+stem()+leaf()+shine(21,29),
  "fruit-5":ellipse(32,38,25,20,"#eda642")+stem()+leaf(34,14)+line("M18 44q14 9 27-1","#d58c32",1.5),
  "fruit-6":path("M7 34c4-22 30-28 44-8l6 3-4 7C48 59 21 61 9 41l-5-4Z","#dfc84e")+leaf(35,13)+shine(21,30),
  "fruit-7":line("M31 11v11","#7f6749",3)+leaf(31,13)+[[23,25],[36,25],[17,35],[30,35],[43,35],[24,45],[36,45],[30,54]].map(([x,y])=>circle(x,y,8,"#885388")+circle(x-2,y-3,2,"#ba8db0")).join(""),
  "fruit-8":path("M23 13l-2-8 10 5 10-5-2 10C64 25 53 59 32 59 7 59 2 25 23 13Z","#b8434c")+path("M31 18C14 21 13 47 31 54Z","#f0c4a3")+[[24,27],[20,35],[25,43],[29,34],[24,51]].map(([x,y])=>ellipse(x,y,2.5,3.5,"#bd4050")).join(""),
  "fruit-9":roundFruit("#e89d7f")+line("M33 21q-10 14-1 33","#c9766c",2),
  "fruit-10":circle(32,37,21,"#e9ac54")+stem()+leaf()+line("M33 18q-7 19-1 40","#cc8b3f",1.6)+shine(21,30),
  "fruit-11":ellipse(32,37,19,24,"#765384")+stem()+leaf()+shine(24,28),
  "fruit-12":cherry(),"fruit-13":cherry(true),
  "fruit-14":path("M11 24c0 16 15 34 21 35 6-1 21-19 21-35C53 8 11 8 11 24Z","#d65b5a")+path("M13 17l11 1 8-10 6 10 13-1-9 10-10-6-10 7Z","#6a984f")+[[21,30],[33,30],[43,30],[27,40],[38,40],[32,50]].map(([x,y])=>ellipse(x,y,1.4,2.1,"#efd58a")).join(""),
  "fruit-15":path("M5 17h54C57 65 8 65 5 17Z","#6e9c58")+path("M9 18h46C52 57 12 57 9 18Z","#d4ddb0")+path("M12 18h40C49 52 15 52 12 18Z","#da7474")+[[20,25],[31,28],[43,25],[25,39],[38,39]].map(([x,y])=>ellipse(x,y,1.6,2.7,"#6d514b")).join(""),
  "fruit-16":ellipse(32,36,23,25,"#e3bf6a")+line("M19 16q-7 20 0 40M32 11v50M45 16q7 20 0 40","#b79b56",1.6)+line("M11 28h42M10 43h44","#f0d995",1.3),
  "fruit-17":ellipse(32,36,23,25,"#8c7752")+ellipse(32,36,18,21,"#9cb968")+ellipse(32,36,6,10,"#e7dfad")+Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return ellipse(32+12*Math.cos(a),36+15*Math.sin(a),1,2,"#4c5540",`transform="rotate(${i*30} ${32+12*Math.cos(a)} ${36+15*Math.sin(a)})"`);}).join(""),
  "fruit-18":roundFruit("#df974b")+path("M17 18l11-4 5-7 4 8 11 2-10 7-6-4-8 5Z","#6a8843"),
  "fruit-19":roundFruit("#c8b44e","M32 18C9 9 5 35 16 51c7 11 16 8 16 5 3 5 14 4 20-7C63 27 48 9 32 18Z"),
  "fruit-20":path("M29 10c-1 13-20 21-20 34 0 23 46 23 46 0 0-13-19-21-20-34Z","#856780")+path("M32 17C28 29 19 34 19 45c0 15 27 15 27 0 0-11-10-16-14-28Z","#d98c9c")+[[29,33],[25,42],[34,42],[30,51],[39,49]].map(([x,y])=>circle(x,y,1.6,"#f6d7b3")).join("")+line("M29 10h6","#6f7e42",3),
  "vegetable-1":ellipse(32,36,25,17,"#bd9b67",'transform="rotate(-28 32 36)"')+[[19,35],[31,27],[41,40],[27,45]].map(([x,y])=>ellipse(x,y,1.5,1,"#917449")).join(""),
  "vegetable-2":path("M29 17C23 23 7 26 10 43c4 23 42 23 46 0 3-17-13-20-19-26Z","#c8a176")+line("M30 20q-18 19-4 36M35 20q17 19 4 36M32 21v36","#e6c9a2",1.7)+line("M29 17 27 5M32 17V4M35 17 39 6","#6e9a55",3),
  "vegetable-3":path("M24 20 49 29 13 59q-7 3-4-4Z","#df9545")+line("M29 17 28 4M33 18 40 5M37 21 51 12","#6b9b52",5)+line("M24 31l8 3M17 42l7 3","#c77838",2),
  "vegetable-4":circle(32,37,24,"#d26651")+path("M17 16l12 2 4-10 4 11 12-3-10 10-7-4-10 5Z","#67934d")+shine(20,31),
  "vegetable-5":path("M13 50c-9-11 17-43 31-39 23 5-11 57-26 43Z","#739b54")+line("M18 44 40 19","#a2bc78",3)+ellipse(46,45,13,12,"#639b53")+ellipse(46,45,10,9,"#cbdc96")+[[43,42],[49,42],[46,49]].map(([x,y])=>ellipse(x,y,1,2,"#f0e7bb")).join(""),
  "vegetable-6":cabbage(),
  "vegetable-7":path("M31 12C28 27 7 25 10 43c4 23 40 23 44 0 3-18-18-16-19-31Z","#e1d5bc")+line("M31 22q-16 18-7 32M34 22q14 18 6 32M32 24v32","#b8a3a0",1.8)+path("M29 4h7l-1 14h-5Z","#bea582"),
  "vegetable-8":pepper("#779c57"),
  "vegetable-9":path("M45 18c16 25-8 43-36 40 19-9 27-20 23-35Z","#ce6551")+path("M31 23q4-15 15-12l4 7-10 8Z","#698c49")+line("M44 12q-2-6 3-8","#698c49",3),
  "vegetable-10":path("M35 19C13 16 5 45 13 53c13 14 45-6 37-25Z","#85668f")+path("M28 19 39 10l14 13-10 8-6-10-8 4Z","#6e9a53")+line("M40 12q2-8 8-8","#698f4d",3)+shine(21,39),
  "vegetable-11":ellipse(32,38,27,22,"#d69a4f")+ellipse(32,38,18,22,"#e7ab5d")+ellipse(32,38,7,22,"#efb66a")+path("M28 7h8l-1 12h-7Z","#7a8c4a"),
  "vegetable-12":ellipse(32,39,20,19,"#a6546c")+line("M32 56q3 4 1 7","#a6546c",2)+line("M30 23 20 5M33 23 35 4M35 25 49 10","#6c9855",4)+leaf(16,14),
  "vegetable-13":path("M29 20C5 20 8 49 29 55l3 7 4-7c23-6 23-35-1-35Z","#ded7bd")+line("M29 21 18 5M32 20V3M36 22 48 7","#77a45c",4),
  "vegetable-14":circle(31,39,20,"#d66d81")+path("M12 40q2 17 19 19 19 0 20-19-15 9-39 0Z","#e7d9cb")+line("M28 20 19 6M32 20 33 3M35 21 46 8","#739e54",4),
  "vegetable-15":florets("#e4dfbd","#97b471"),
  "vegetable-16":florets("#6a9759","#9bb873"),
  "vegetable-17":path("M11 47 38 13q6-7 14-1t3 13L28 57q-11 9-17-10Z","#95ae67")+line("M18 47 44 19","#c1cf98",3)+path("M46 10l4-6 7 5-4 6Z","#6f8f4d"),
  "vegetable-18":ellipse(32,31,14,25,"#e4bd52")+[0,1,2,3,4].map(i=>line(`M23 ${13+i*8}h18`,"#b79737",1.4)).join("")+line("M31 8v47","#f6d873",2)+path("M32 59C4 48 8 25 13 20c4 15 14 20 19 39Z","#82a25b")+path("M32 59c28-11 24-34 19-39-4 15-14 20-19 39Z","#6d934d"),
  "vegetable-19":line("M20 49 28 5M28 51 41 5M37 50 53 13","#77a15c",6)+line("M18 60 21 45M27 61 30 46M36 61 40 45","#dddac1",7),
  "vegetable-20":line("M31 58 16 18M31 57 34 8M31 56 51 21","#729651",3)+[[12,17],[21,22],[29,17],[36,10],[42,21],[51,22],[22,34],[39,35]].map(([x,y])=>path(`M${x} ${y}q-10-8-7-12 8-3 10 4 8-5 11 1 0 8-14 7Z`,"#81a765")).join(""),
  "grain-1":bowl("#f7f0d8","long"),"grain-2":stalk("#d5b15d"),
  "grain-3":bowl("#e1b34e"),"grain-4":bowl("#9e7f5d","triangle"),
  "grain-5":bowl("#d9c39b","long"),"grain-6":bowl("#b99c6b","triangle"),
  "grain-7":bowl("#e6d6a7"),"grain-8":bowl("#d6ba62"),
  "grain-9":bowl("#e5d8ba","long"),"grain-10":bowl("#c99955","triangle")
};
const names = {
  fruit:["Olma","Nok","Banan","Apelsin","Mandarin","Limon","Uzum","Anor","Shaftoli","O‘rik","Olxo‘ri","Gilos","Olcha","Qulupnay","Tarvuz","Qovun","Kivi","Xurmo","Behi","Anjir"],
  vegetable:["Kartoshka","Piyoz","Sabzi","Pomidor","Bodring","Karam","Sarimsoq","Bulg‘or qalampiri","Achchiq qalampir","Baqlajon","Qovoq","Lavlagi","Turp","Rediska","Gulkaram","Brokkoli","Kabachki","Makkajo‘xori","Ko‘k piyoz","Ko‘katlar (ukrop, kashnich, petrushka)"],
  grain:["Guruch","Bug‘doy","Makkajo‘xori","Grechka","Suli yormasi","Arpa yormasi","Manna yormasi","Tariq","Perlovka","Bulgur"]
};
const normalize = value => String(value || "").trim().toLowerCase().replace(/[‘’ʻʼ`]/g,"'");
const keysByName = new Map(Object.entries(names).flatMap(([category,list])=>list.map((name,i)=>[`${category}:${normalize(name)}`,`${category}-${i+1}`])));
const generic = path("M9 20 32 8l23 12v26L32 58 9 46Z","#bcc7af")+line("M9 20 32 33l23-13M32 33v25","#819376",2);
export function productArt(product) {
  const key = product?.catalog_key || product?.key || keysByName.get(`${product?.category}:${normalize(product?.name_uz)}`);
  return `<svg class="product-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${art[key] || generic}</svg>`;
}
