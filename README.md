# 💣 Bomba Pasla Oyunu (Bomb Pass Party Game)

Arkadaşlarla gerçek zamanlı oynanan, yetenekli, gizli süreli ve cezalı parti oyunu! 💥

## 🚀 Özellikler

- **Gerçek Zamanlı Multiplayer:** Socket.io tabanlı oda sistemi (Oda kodu ile katılma).
- **Gizli Bomba Süresi:** 1 - 3 dakika arası gizli fitil; bomba kimin elinde patlarsa o elenir!
- **Pas Kilidi (1 - 10 saniye):** Bomba eline geldiğinde pas atabilmek için kilit süresinin dolması gerekir.
- **7 Efsanevi Özel Yetenek (Tekil Dağıtım):**
  - ⚡ **Kilit Kırıcı (Adrenalin):** Pas kilidini anında sıfırlar.
  - 🪞 **Ayna (Bumerang):** Bombayı sana atan kişiye geri iade eder.
  - 🧊 **Buz Küpü (Dondurma):** Hedef oyuncuyu 5 saniyeliğine dondurur.
  - 🧲 **Mıknatıs (Zorunlu Hedef):** Bombayı tutan kişinin bir sonraki pasını seçtiğin kişiye zorlar.
  - ⏩ **Zaman Hızlandırıcı:** Toplam süreden 10 saniye siler (10 sn altındaysa anında patlar!).
  - 👁️ **Zaman Röntgeni:** Gizli bomba süresini 3 saniyeliğine sana gösterir.
  - 🔀 **Yer Değiştirme:** Hedefle anında yer ve bomba takası yapar.
- **Cooldown Sistemi:** Yetenek kullanıldıktan sonra ancak bombaya 2. kez dokunulduğunda tekrar aktifleşir.
- **Yetenek Sembol Efekti:** Yetenek basıldığında oyuncunun kafasında 1 saniye sembol patlar.
- **Yaratıcı Cezalar & Zar (🎲):** Lobide cezalar gizlidir, bomba patlayınca ortaya çıkar!
- **Skor ve Liderlik Kürsüsü:** Kazananlar için kupa sistemi (🥇, 🥈, 🥉).
- **Neon Database Entegrasyonu:** PostgreSQL tabanlı kalıcı skor tablosu ve oyun geçmişi.

---

## 🛠️ Yerel Kurulum (Local)

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme modu (Client + Server)
npm run dev

# Veya sadece sunucu
npm start
```

---

## 🗄️ Neon Database Kurulumu (PostgreSQL)

1. [Neon.tech](https://neon.tech) adresine ücretsiz kaydolun ve bir veritabanı projesi oluşturun.
2. Size verilen bağlantı adresini (Connection String) kopyalayın:
   `postgresql://username:password@ep-xyz.eu-central-1.aws.neon.tech/neondb?sslmode=require`
3. Proje ana dizininde `.env` dosyası oluşturup ekleyin:
   ```env
   DATABASE_URL=postgresql://username:password@ep-xyz.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Sunucu başladığında `leaderboard` ve `game_history` tabloları otomatik oluşturulur!

---

## 🌐 İnternete Yayma (Canlı Dağıtım)

> **Önemli Not:** Bomba Pasla oyunu gerçek zamanlı WebSocket (Socket.io) kullandığı için sunucusuz (serverless) Vercel tek başına sürekli açık WebSocket bağlantılarını desteklemez. Bu nedenle en pratik iki yöntem mevcuttur:

### Yöntem 1: Render.com (En Kolay & Ücretsiz - Tek Tıkla Canlıya Alma)
1. GitHub reponuzu [Render.com](https://render.com)'a bağlayın.
2. **New +** -> **Web Service** seçin.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Environment Variables kısmına:
   - `DATABASE_URL`: *(Neon connection string)*
6. **Deploy** butonuna basın. Hem arayüz hem Socket.io sunucusu tek bir kalıcı link altında sorunsuz çalışır!

### Yöntem 2: Vercel (Frontend) + Render/Railway (Backend)
1. Backend'i Render veya Railway üzerinde çalıştırın (örneğin `https://bomba-server.onrender.com`).
2. Vercel'e reponuzu bağlayın.
3. Vercel Environment Variables kısmına şunu ekleyin:
   - `VITE_SERVER_URL`: `https://bomba-server.onrender.com`
4. Deploy edin!
