require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const admin = require("firebase-admin"); // 🔥 Firebase Admin SDK

const app = express();
const PORT = process.env.PORT || 3000;

// 🔑 API KEY'LER
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const FIREBASE_ADMIN_SDK_BASE64 = process.env.FIREBASE_ADMIN_SDK_BASE64;

// ✅ Admin SDK base64 string'den initialize
if (!FIREBASE_ADMIN_SDK_BASE64) {
  console.error("❌ FIREBASE_ADMIN_SDK_BASE64 tanımlı değil!");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(FIREBASE_ADMIN_SDK_BASE64, "base64").toString("utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(express.json());
app.use(cors());

/* 📌 GOOGLE PLACES API */
app.get("/api/places/search", async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: "Query param is required" });
  }

  try {
    const response = await axios.get("https://maps.googleapis.com/maps/api/place/findplacefromtext/json", {
      params: {
        input: query,
        inputtype: "textquery",
        fields: "place_id,name,formatted_address",
        locationbias: "circle:1000000@39.9334,32.8597",
        key: GOOGLE_PLACES_API_KEY,
      },
    });
    res.json(response.data.candidates || []);
  } catch (error) {
    console.error("❌ Error fetching places:", error.message);
    res.status(500).json({ error: "Failed to fetch places" });
  }
});

app.get("/api/places/details/:placeId", async (req, res) => {
  const placeId = req.params.placeId;
  if (!placeId) {
    return res.status(400).json({ error: "Place ID is required" });
  }

  try {
    const response = await axios.get("https://maps.googleapis.com/maps/api/place/details/json", {
      params: {
        place_id: placeId,
        fields: "place_id,name,formatted_address,formatted_phone_number,url,geometry,opening_hours",
        language: "tr",
        key: GOOGLE_PLACES_API_KEY,
      },
    });

    const placeDetails = response.data.result || {};
    const workingHours = placeDetails.opening_hours?.weekday_text || ["Çalışma saatleri mevcut değil"];

    const formattedDetails = {
      place_id: placeDetails.place_id || "",
      name: placeDetails.name || "",
      address: placeDetails.formatted_address || "",
      phone: placeDetails.formatted_phone_number || "",
      url: placeDetails.url || "",
      geometry: placeDetails.geometry ? {
        lat: placeDetails.geometry.location.lat,
        lng: placeDetails.geometry.location.lng
      } : null,
      workingHours
    };

    res.json(formattedDetails);
  } catch (error) {
    console.error("❌ Error fetching place details:", error.message);
    res.status(500).json({ error: "Failed to fetch place details" });
  }
});

/* 📣 FCM BİLDİRİM GÖNDERME (V1) */
app.post("/api/send-notification", async (req, res) => {
  const { fcmToken, title, body } = req.body;

  if (!fcmToken || !title || !body) {
    return res.status(400).json({
      error: "Eksik parametre: fcmToken, title, body gerekli.",
    });
  }

  const message = {
    token: fcmToken,
    notification: {
      title,
      body,
    },
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "default",
        notificationCount: 1,
      },
    },
  };

  console.log("📤 Bildirim gönderiliyor:", JSON.stringify(message, null, 2));

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Bildirim başarıyla gönderildi:", response);
    res.json({ success: true, messageId: response });
  } catch (error) {
    console.error("💥 Bildirim gönderim hatası:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Bilinmeyen bir hata oluştu.",
    });
  }
});

/* 👀 Takipçi değişimini sürekli dinle */
function detectFollowersChanges() {
  const db = admin.firestore();
  const usersRef = db.collection("users");

  usersRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const doc = change.doc;
      const data = doc.data();
      const userId = doc.id;

      if (change.type === "modified") {
        const previous = change.oldIndex >= 0 ? snapshot.docs[change.oldIndex]?.data() : null;
        const oldFollowers = previous?.followers || [];
        const newFollowers = data.followers || [];

        if (newFollowers.length > oldFollowers.length) {
          const newFollower = newFollowers.find(f => !oldFollowers.includes(f));
          console.log(`👤 ${userId} için yeni takipçi: ${newFollower}`);

          const fcmToken = data.fcmToken;
          if (fcmToken) {
            const msg = {
              token: fcmToken,
              notification: {
                title: "Yeni Takipçin Var!",
                body: "Bir kullanıcı seni takip etti.",
              },
              android: {
                priority: "high",
                notification: {
                  sound: "default",
                  channelId: "default",
                  notificationCount: 1,
                },
              },
            };

            admin.messaging().send(msg)
              .then((response) => {
                console.log(`✅ Bildirim gönderildi: ${response}`);
              })
              .catch((error) => {
                console.error("❌ Bildirim gönderilemedi:", error.message);
              });
          } else {
            console.warn(`⚠️ Kullanıcının fcmToken'ı yok: ${userId}`);
          }
        }
      }
    });
  }, (error) => {
    console.error("🔥 Firestore takip dinleme hatası:", error);
  });
}

/* 🚀 SUNUCU BAŞLAT */
app.listen(PORT, () => {
  console.log(`🚀 Proxy + FCM sunucusu çalışıyor: http://localhost:${PORT}`);
  detectFollowersChanges(); // 🔔 Dinleme başlasın
});