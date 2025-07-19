require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3000;

// API Key'ler
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const FIREBASE_ADMIN_SDK_BASE64 = process.env.FIREBASE_ADMIN_SDK_BASE64;

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

const db = admin.firestore();

app.use(express.json());
app.use(cors());

/* 🌍 Google Places API */
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

/* 📍 Place Details */
// 📍 Place Details (query param ile)
app.get("/api/places/details", async (req, res) => {
  const placeId = req.query.placeId;
  if (!placeId) {
    return res.status(400).json({ error: "Place ID is required" });
  }

  try {
const response = await axios.get("https://maps.googleapis.com/maps/api/place/details/json", {
  params: {
    place_id: placeId,
    fields: "place_id,name,formatted_address,formatted_phone_number,url,geometry,opening_hours,rating",
    language: "tr",
    key: GOOGLE_PLACES_API_KEY,
  },
});

    const result = response.data.result || {};
res.json({
  place_id: result.place_id || "",
  name: result.name || "",
  address: result.formatted_address || "",
  phone: result.formatted_phone_number || "",
  url: result.url || "",
  geometry: result.geometry?.location || null,
  workingHours: result.opening_hours?.weekday_text || [],
  rating: result.rating || 0,
});
  } catch (error) {
    console.error("❌ Error fetching place details:", error.message);
    res.status(500).json({ error: "Failed to fetch place details" });
  }
});

/* 📣 Manuel FCM Bildirim API */
app.post("/api/send-notification", async (req, res) => {
  const { fcmToken, title, body } = req.body;

  if (!fcmToken || !title || !body) {
    return res.status(400).json({
      error: "Eksik parametre: fcmToken, title, body gerekli.",
    });
  }

  const message = {
    token: fcmToken,
    notification: { title, body },
    android: {
      priority: "high",
      notification: {
        sound: "default",
        channelId: "default",
        notificationCount: 1,
      },
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("✅ Bildirim gönderildi:", response);
    res.json({ success: true, messageId: response });
  } catch (error) {
    console.error("💥 Bildirim hatası:", error.message);
    res.status(500).json({ success: false, error: error?.message });
  }
});

/* 🔔 Takipçi Artışını Dinle ve Bildirim Gönder */
db.collection("users").onSnapshot(async (snapshot) => {
  snapshot.docChanges().forEach(async (change) => {
    if (change.type !== "modified") return;

    const userDoc = change.doc;
    const userId = userDoc.id;
    const newFollowers = userDoc.data().followers || [];

    const oldData = snapshot.docs.find(d => d.id === userId)?.data() || {};
    const oldFollowers = oldData.followers || [];

    const addedFollowers = newFollowers.filter(f => !oldFollowers.includes(f));
    if (addedFollowers.length === 0) return;

    for (const newFollowerId of addedFollowers) {
      try {
        const userSnap = await db.collection("users").doc(userId).get();
        const newFollowerSnap = await db.collection("users").doc(newFollowerId).get();

        if (!userSnap.exists || !newFollowerSnap.exists) return;

        const fcmToken = userSnap.data().fcmToken;
        const followerName = `${newFollowerSnap.data().firstName} ${newFollowerSnap.data().lastName}`;

        if (fcmToken) {
          const msg = {
            token: fcmToken,
            notification: {
              title: "Yeni Takipçin Var!",
              body: `${followerName} seni takip etmeye başladı.`,
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

          const response = await admin.messaging().send(msg);
          console.log(`📣 ${userId} kullanıcısına bildirim gönderildi: ${response}`);
        }
      } catch (err) {
        console.error(`❌ Takipçi bildirimi hatası (${userId}):`, err.message);
      }
    }
  });
});

/* 🚀 Sunucuyu Başlat */
app.listen(PORT, () => {
  console.log(`🚀 Proxy + FCM sunucusu çalışıyor: http://localhost:${PORT}`);
});