# MAGUS – Harcrendszer szabálykézikönyv

---

## 1. A harc menete

### Harci kör és szegmensek

- Egy **harci kör** = **10 szegmens** (másodperc).
- Minden szegmens egyidejű cselekvést modellez; a kör végén új kör kezdődik.
- A kör végeztével **új Kezdeményező dobást** kell tenni.

### A kör lefolyása

1. **Kezdeményező dobás** – meghatározza a cselekvési sorrendet.
2. **Bejelentés** – mindenki bejelenti, mit kíván tenni.
3. **Cselekvések végrehajtása** – csökkenő Kezdeményezés-sorrendben.
4. Aki az elszenvedett sebzés ellenére képes folytatni, újabb támadásokat is leadhat (ha a Támadások száma engedi).

---

## 2. Cselekedetek típusai

### Szabad cselekedet

Olyan rövid ideig tartó manőverek, amelyek egy harci cselekedettel egyidőben is elvégezhetők (kb. 1–2 szegmens).

| Szabad cselekedet |
|---|
| Varázslás (egyes, rövid varázslatok – lásd 13. fejezet) |
| Pszi használat |
| Kiáltás |
| Földre vetődés |
| Fegyver / tárgy elejtése |
| Fegyverrántás |
| Varázsital felhajtása |

- Ha a szabad cselekedet **támadás előtt** hajtják végre: a karakter automatikusan elveszíti a Kezdeményezést az egész körre.
- Ha **támadás után**: nincs hátrány.

### Mozgásértékű cselekedet

Kizárólag helyváltoztatásra alkalmazható. Az aktuális (páncél és felszerelés által esetleg csökkentett) Gyorsaság-érték az irányadó.

| Mozgásforma | Távolság körenként |
|---|---|
| Sétálva | ~12 ynevi láb |
| Futva | Gyorsaság × 3 ynevi láb |
| Rohanva | Gyorsaság × 5 ynevi láb (szegmensenként: Gyorsaság ÷ 2) |

- Rohanás legfeljebb Állóképesség × 3 körig tartható.

### Harci cselekedet

A karakter ellenfelét közelharcban vagy távolsági fegyverrel megtámadja; a fegyver **Időigénye** határozza meg, mikor teheti ezt meg.

| Harci cselekedet | Időigény |
|---|---|
| Közelharc, 1. méretkategória | 3 szegmens |
| Közelharc, 2. méretkategória | 3 szegmens |
| Közelharc, 3. méretkategória | 5 szegmens |
| Közelharc, 4. méretkategória | 10 szegmens |
| Közelharc, 5. méretkategória | 10 szegmens |
| Távolsági támadás | 2 szegmens |
| Újratöltés – fúvócső | 1 szegmens |
| Újratöltés – íj | 1 szegmens |
| Újratöltés – dobófegyver | 1 szegmens |
| Újratöltés – könnyű számszeríj | 1 szegmens |
| Újratöltés – vadász számszeríj | 3 szegmens |
| Újratöltés – nehéz számszeríj | 2 kör |
| Újratöltés – shadleki páncéltörő | 4 kör |
| Talpra állás | az ellenfél harci cselekedetének hossza (közelharcban), egyéb esetben 2 szegmens |

> A közelharcnál megadott időigény azt jelzi, mennyi ideig tart rést találni az ellenfél védelmén – nem magának az ütésnek az ideje.

### Egészkörös cselekedet

Az egész kört lefoglalja; a karakter mást nem tud csinálni.

- **Közelharc** – mindkét fél csak a küzdelemmel foglalkozik.
- **Védekező harc** – az egyik fél feladja támadásait, cserébe mozgásértékű cselekedetként hátrálhat.
- **Roham** – mozgás (mozgásértékű cselekedet) + csapás (harci cselekedet). Ha az ellenfél elesik, a maradék idő szabadon felhasználható; ha nem, a kör hátralévő részét harc tölti ki (az ellenfél legalább 1 támadást leadhat).
- **Képzettségek alkalmazása** (kivéve azok, amelyek nem igényelnek eltérő cselekvést, pl. Harcművészet, Pusztítás).

---

## 3. Harcmodor és méretkategóriák

A MAGUS öt méretkategóriát ismer:

| Kategória | Típus |
|---|---|
| 1. | Pusztakéz vagy ökölfegyverek |
| 2. | Tőr jellegű fegyverek |
| 3. | Egykezes fegyverek |
| 4. | Nehézfegyverek |
| 5. | Nyeles fegyverek |

**Szabály:** egy fegyver harcértékei (és a Fegyverhasználat képzettség bónuszai) csak akkor adódnak hozzá a fegyvertelen értékekhez, ha az ellenfél azonos vagy **kisebb** méretkategóriájú fegyvert forgat. Nagyobb kategóriájú fegyver ellen a karakter kizárólag fegyvertelen harcértékeivel küzdhet (de a fegyver sebzése megmarad).

> **Kivétel:** megfelelő szintű Fegyverhasználat képzettséggel ez a hátrány kiküszöbölhető (lásd a Fegyverhasználat képzettséget).

---

## 4. Harcértékek

Minden karakter (JK, NJK, szörnyeteg) rendelkezik harcértékekkel, amelyek a tapasztalatot szimbolizálják.

### Összetevők

| Rövidítés | Neve | Képlete |
|---|---|---|
| KÉ | Kezdeményező érték | Gyorsaság + Érzékelés + KÉ-re fordított HM + Fegyver KÉ |
| TÉ | Támadó érték | Erő + Gyorsaság + Ügyesség + TÉ-re fordított HM + Fegyver TÉ |
| VÉ | Védő érték | 60 + Gyorsaság + Ügyesség + VÉ-re fordított HM + Fegyver VÉ + Pajzs VÉ |
| CÉ | Célzó érték | Ügyesség + Érzékelés + CÉ-re fordított HM + Fegyver CÉ + Faji bónusz |

### Harcérték módosító (HM)

Szintlépésenként a karakter HM-pontokat oszthat szét a négy harcérték között, szabadon döntve az arányokról.

---

## 5. Kezdeményező dobás

A Kezdeményező dobás eldönti, ki cselekedhet elsőként a körben.

**Dobás:** k10 + saját KÉ = Kezdeményezés

- Legmagasabb Kezdeményezéssel rendelkező cselekedhet elsőként; a többiek csökkenő sorrendben követik.
- Ha valaki **cselekedni** kíván (nem fegyveres harc), a fegyver nélküli KÉ-hez +10 adódik.
- Egyforma Kezdeményezés esetén a támadások **egyidőben** történnek.

### Sebzés utáni automatikus hátrány

Ha valaki az előző körben **Ép-veszteséget** szenvedett, a következő körben **automatikusan elveszíti a Kezdeményezést** (utolsóként cselekedhet).
- Ha többen is sebesültek, a sértetlen(ek) kezdeményeznek először.
- Több sértetlen fél esetén köztük normál Kezdeményező dobást kell tenni.

---

## 6. Támadó dobás (közelharcban)

**Dobás:** k100 + TÉ ≥ ellenfél VÉ → találat

- **00-ás dobás:** automatikus találat; páncél SFÉ-je nem érvényesül; a normál sebzésen felül +3 Ép-veszteség.
- **01-es dobás:** automatikus kudarc, függetlenül a TÉ-től.

---

## 7. Célzó dobás (távolsági harc)

**Dobás:** k100 + CÉ ≥ célpont VÉ (távolsági) → találat

A célpont távolsági VÉ-je: **távolság (ynevi lábban) + 50**, módosítva az alábbiak szerint.

### Célpont viselkedése

| Viselkedés | VÉ-módosító |
|---|---|
| Mozdulatlan | −40 |
| Kiszámíthatóan mozgó | −10 |
| Kiszámíthatatlanul mozgó | +30 |
| Kitérésre összpontosító* | +50 |

*Ha a megcélzott harcművész és a Kitérés diszciplínát alkalmazza, saját VÉ-jét fordíthatja szembe a Célzó dobással.

### Időjárás

| Időjárás | VÉ-módosító |
|---|---|
| Napsütés, szélcsend | 0 |
| Szemerkélő eső, szellő | +10 |
| Gyenge eső, gyenge szél | +30 |
| Ritkább köd / eső / erős szél | +50 |
| Sűrű köd / zivatar / viharos szél | +70 |
| Egészen sűrű köd / felhőszakadás / orkán | +100 |

### Célpont mérete

| Méret | VÉ-módosító |
|---|---|
| Óriás | −50 |
| Szekér | −30 |
| Ló | −10 |
| Ember | 0 |
| Kutya | +10 |
| Dinnye | +30 |
| Alma | +50 |
| Pénzérme | +70 |

### Íjász szabály (kritikus sebzés)

Ha a sebzésdobáshoz használt kocka maximumra esik (k10-en 10, k6-on 6), az adott kockával még egyszer lehet dobni; az eredmény hozzáadódik a sebzéshez. Ez megismételhető, amíg a kocka maximumot ad.

---

## 8. Célzott támadás

A célzott testrészt a Támadó dobás előtt be kell jelenteni a KM-nek. A megcélzott testrész megnövelt VÉ-vel rendelkezik.

| Testrész | Hozzávetőleges VÉ-módosító |
|---|---|
| Kar / láb | +10 |
| Fej | +30 |
| Torok, kézfej, lábfej, lágyék | +50 |
| Szem, ujjak, száj | +70 |

*A pontos módosítót mindig a KM határozza meg.*

---

## 9. Sebzés

### Alap sebzés

- Sikeres találat után sebzésdobás; az eredményt az áldozat **Fájdalomtűrési pontjaiból (Ep)** kell levonni.
- A viselt páncél **Sebzésfelfogó értéke (SFÉ)** levonódik a sebzésből (páncél csak ott véd, ahol viselik).

### Találat helye (nem célzott támadásnál)

| Dobás k10-en | Testrész |
|---|---|
| 10 | Fej |
| 5–9 | Törzs |
| 4–5 | Jobb (fegyverforgató) kar |
| 3 | Bal (gyengébbik) kar |
| 2 | Bal láb |
| 1 | Jobb láb |

### Túlütés

Ha a Támadó / Célzó dobás eredménye **50-nel meghaladja** az ellenfél VÉ-jét: a sebzés nem Ep-ből, hanem egyenesen **Ép-ből** vonódik le. Minden elvesztett Ép egyben duplájának megfelelő Ep-veszteséget is okoz.

### Csonkolás és bénítás

Túlütés esetén lehetséges csonkolás:
- **Bénítás:** az egy csapással okozott sebzés eléri az adott testrész maximális Ép-tűrőképességét.
- **Csonkolás:** az egy csapással okozott sebzés legalább kétszerese a testrész maximális Ép-tűrőképességének.

| Testrész | Maximális Ép-sebzés |
|---|---|
| Csukló / lábfej | A max. Ép 1/5-e |
| Alkar / lábszár | A max. Ép 1/5-e |
| Kar / láb | A max. Ép 1/4-e |
| Fej | A max. Ép 1/2-e |
| Törzs | Max. Ép |

- Fejbénítás: maradandó, csak mágiával gyógyítható.
- Fej vagy törzs csonkolása: azonnali halál – Morális szabály tiltja JK ellen.
- Csonkítani csak megfelelő méretű **vágófegyverrel** lehet; szúró- vagy zúzófegyverrel csak bénítás lehetséges.

### 00-ás szabály

00-ás dobásnál a páncél SFÉ-je nem érvényesül (varázslatos védelem igen), és az áldozat a normál sebzésen felül **+3 Ép-t** veszít.

### Morális szabály

Játékos karaktert **egyetlen támadással nem lehet 0 Ép alá sebezni** – legfeljebb 0-ra kerülhet (eszméletlen, harcképtelen, de él). Ebben az állapotban 10 kör alatt elvérzik, ha nem kap segítséget; minden további támadás (ami már nem igényel Támadó dobást) halálos.

---

## 10. Harci helyzetek és módosítók

| Harci helyzet | KÉ | TÉ | VÉ | CÉ |
|---|---|---|---|---|
| Meglepetésszerű támadás (támadónak) | övé | +30 | — | — |
| Harc magasabbról | — | +15 | +5 | — |
| Harc helyhez kötve | −10 | — | −10 | — |
| Harc fekve | nincs | −20 | −10 | nincs* |
| Harc mozgó lóról (3. fokú Lovaglással) | — | +20 | +10 | — |
| Harc vakon / vaksötétben | nincs | −60 | −60 | −150 |
| Harc láthatatlan ellenféllel | nincs | −40 | −40 | −75 |
| Harc félelem hatása alatt | ellenféle | −20 | +10 | — |
| Harc gyűlölettel eltelve | +5 | +5 | −10 | — |
| Roham | — | +20 | −20 | −20 |
| Harc az ellenfél elfogásáért | — | −10 | — | nincs |
| Harc kábultan | −10 | −20 | −10 | −30 |
| Képzetlen fegyverforgatás | ellenféle | — | — | — |
| Védekező harc (szabad tér) | ellenféle | nincs | +40 | nincs |
| Védekező harc (falhoz szorítva) | ellenféle | nincs | +25 | nincs |
| Védekező harc (megosztott figyelem) | ellenféle | nincs | +10 | nincs |

*Közelharc közben fekve lehetetlen célzófegyvert használni. Harcon kívül fekve csak nyílpuskával és fúvócsővel lehet célozni.

### Részletes megjegyzések

**Meglepetésszerű támadás:** a célpont nincs felkészülve; a kezdeményezés a támadóé; az előnyök csak az adott körre érvényesek.

**Roham:** sikeres roham vagy a rohamozó ellen végrehajtott feltartó támadás esetén a sebzés **kétszeres** (nem vonatkozik hajítófegyverekre és lövedékekre). Ha mindkét fél rohamoz, a kétszeres sebzés mindkettőre érvényes, de nem négyszereződik. Többszörös támadás csak akkor lehetséges, ha a roham nem törik meg (senki nem dob sikeres Támadó dobást a rohamozó ellen, és nem kerül akadály az útjába).

**Harc az ellenfél elfogásáért:** csak közelharci; a túlütés Ep-sebet okoz (kétszeres Ep); az utolsó csapásnál az áldozat elájul (Ép-re nem csúszik át).

**Harc bénultan:** a lebénult végtaghoz kapcsolódó fegyver/pajzs/alkarvédő módosítók elvesznek. Teljes bénulás esetén a karakter magatehetetlen célpont: VÉ = 0.

**Támadás hátulról:** az áldozat elveszíti a fegyver és a pajzs VÉ-módosítóit (amíg a támadó mögötte marad).

**Támadás oldalról / félhátulról:** az áldozat elveszíti a fegyver *vagy* a pajzs VÉ-módosítóját az adott oldalon (amíg szembe nem fordul).

**Képzetlen fegyverforgatás:** a karakter nem bír Fegyverhasználat (vagy adott esetben Pusztakezes harc) képzettséggel az adott fegyvernél. Következmény: elveszíti a KÉ-t (ha ellenfele képzett), nem kapja meg a fegyver harcértékeit, és kockadobásonként 1 ponttal kevesebbet sebez (minimum 1 Sp).

---

## 11. Túlerő

Ha valaki egyszerre több ellenfél ellen harcol, Védő értéke csökken.

| Ellenfelek száma | VÉ-csökkentés (egy fegyverrel) | VÉ-csökkentés (két fegyver / pajzs + képzettség) |
|---|---|---|
| 1 | nincs | nincs |
| 2 | −5 | nincs |
| 3 | −10 | −5 |
| 4 | −15 | −10 |
| 5 | −20 | −15 |
| 6 | −25 | −20 |
| 7 | −30 | −25 |
| 8 | −35 | −30 |

- Kétkezes harc (vagy Pajzshasználat képzettséggel) esetén 2 ellenfélig nincs hátrány.
- Háttal a falnak: legfeljebb 4 ellenfél tud egyszerre támadni.
- Párban, egymásnak háttal: fejenként legfeljebb 3 ellenfél.
- Nyeles fegyverrel: legfeljebb 8 ellenfél fér el.

---

## 12. Támadások száma

- A fegyver Időigénye (lásd Harci cselekedetek táblázat) határozza meg, hányszor lehet támadni egy körben.
- Kisebb Időigényű fegyverrel több támadás lehetséges körönként.
- **Harcművészet, Pajzshasználat, Kétkezes harc** képzettségek plusz támadást adhatnak (részleteket lásd az adott képzettségnél); ezek egymással **nem adódnak össze**.
- Magatehetetlen vagy védekezni képtelen ellenfél ellen: körönként annyi támadás, ahányadik szintű a Fegyverhasználat képzettség.

---

## 13. Közelharc és varázslás

### Elsőbbség meghatározása

A hagyományos Kezdeményező dobás csak közelharcban (fegyver vs. fegyver) érvényes. Fegyver vs. mágia esetén az elsőbbséget a körülmények döntik el:

1. **Távolsági fegyver:** mindig megelőzi a varázslót, ha a lőfegyvert felajzva, lövésre készen tartja a körben és kifejezetten a varázshasználóra céloz.
2. **Ha a mágia hamarabb létrejön**, mint a harcos közel ér: a varázslat fogan meg.
3. **Ha a harcos már kardtávolságon belül van** és a mágia még nem jött létre: a harcos megkapja a közelharci támadást.
4. **Ha egyidejűleg cselekszenek** (a varázslat épp a harcos cselekedetével egyidőben fogan): mindkettő **Tulajdonságpróbát** dob (varázshasználó: Intelligencia; harcos: Gyorsaság); a nagyobb eredményt elérő kezdeményez. Döntetlen esetén egyszerre cselekednek.

### Varázslás harcos ellen

- Ha a harcos nem sebzi meg a varázshasználót, az tovább varázsol; a harcos a fegyvere Időigényének lejárta után ismét támadhat.
- A varázslás alatt a varázsló csak **fegyvertelen harcértékét** fordíthatja szembe a Támadó értékkel.

### Fegyver vs. fegyver

Hagyományos Kezdeményező dobás dönt.

### Varázslat vs. varázslat

A rövidebb varázslási idejű varázslat fogan meg hamarabb. Egyforma idő esetén Intelligenciapróba; döntetlen esetén egyszerre hatnak.

### Varázslatok száma egy körben

- Egy körben több rövidebb varázslat is megidézhető.
- Minden egymást követő varázslat között **legalább 2 szegmens pihenő** szükséges (akkor is, ha a varázslás megszakad).

---

## 14. Pszi használata harc közben

- **1 szegmenses** meditáció / diszciplína: bármikor alkalmazható harc közben.
- **Hosszabb koncentrációt igénylő** diszciplínák (15 szegmensnél hosszabb varázslat is): csak nyugodt körülmények között vagy **Védekező harc** esetén alkalmazhatók.
- Az elsőbbség meghatározására a Közelharc és varázslás szabályai vonatkoznak.
- Minden egyes pszi-alkalmazás között **legalább 2 szegmens** pihenő szükséges; ez idő alatt semmilyen koncentrációt igénylő tevékenység (varázslás, diszciplína) nem végezhető.
