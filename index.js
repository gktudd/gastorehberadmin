require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Google Places API Key
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Middleware
app.use(express.json());
app.use(cors());

// 📌 Dinamik Arama Endpoint'i (Türkiye ile sınırlandırıldı)
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
        console.error("Error fetching places:", error.message);
        res.status(500).json({ error: "Failed to fetch places" });
    }
});

// 📌 Mekan Detayları Endpoint'i
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

        // 📌 Çalışma Saatleri (`opening_hours.weekday_text`) Doğru Şekilde Alınıyor
        let workingHours = [];
        if (placeDetails.opening_hours && placeDetails.opening_hours.weekday_text) {
            workingHours = placeDetails.opening_hours.weekday_text;
        } else {
            workingHours = ["Çalışma saatleri mevcut değil"];
        }

        // 📌 Formatlanmış JSON Yanıtı
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
            workingHours // Yeni formatta çalışma saatleri
        };

        res.json(formattedDetails);
    } catch (error) {
        console.error("Error fetching place details:", error.message);
        res.status(500).json({ error: "Failed to fetch place details" });
    }
});

// 📌 Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`Proxy server çalışıyor: http://localhost:${PORT}`);
});