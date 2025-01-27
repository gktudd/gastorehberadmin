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

// Dinamik Arama Endpoint'i
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
                key: GOOGLE_PLACES_API_KEY,
            },
        });
        res.json(response.data.candidates || []);
    } catch (error) {
        console.error("Error fetching places:", error.message);
        res.status(500).json({ error: "Failed to fetch places" });
    }
});

// Tarih formatlama fonksiyonu
const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Zaman bilgisi yok";
    const date = new Date(timestamp * 1000); // Google API zaman damgasını işliyoruz
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`; // "Gün/Ay/Yıl" formatı
};

// Mekan Detayları Endpoint'i
app.get("/api/places/details/:placeId", async (req, res) => {
    const placeId = req.params.placeId;
    if (!placeId) {
        return res.status(400).json({ error: "Place ID is required" });
    }

    try {
        const response = await axios.get("https://maps.googleapis.com/maps/api/place/details/json", {
            params: {
                place_id: placeId,
                fields: "name,formatted_address,formatted_phone_number,url,geometry,opening_hours,rating,user_ratings_total,photos,reviews",
                language: "tr", // Türkçe yorumlar için
                key: GOOGLE_PLACES_API_KEY,
            },
        });

        const placeDetails = response.data.result || {};

        // Fotoğrafları sınırlama ve URL'leri oluşturma
        const photos = (placeDetails.photos || []).slice(0, 5).map((photo) => ({
            url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`,
            attributions: photo.html_attributions || [],
        }));

        // İlk 10 yorumu al, ham tarih ile formatlı zaman bilgisi ekle
        const reviews = (placeDetails.reviews || []).slice(0, 10).map((review) => ({
            author: review.author_name,
            rating: review.rating,
            text: review.text,
            time: formatTimestamp(review.time), // Zaman damgasını formatlıyoruz
        }));

        const formattedDetails = {
            name: placeDetails.name,
            address: placeDetails.formatted_address || "Adres bilgisi yok",
            phone: placeDetails.formatted_phone_number || "Telefon bilgisi yok",
            url: placeDetails.url || "URL bilgisi yok",
            geometry: placeDetails.geometry || "Lokasyon bilgisi yok",
            opening_hours: placeDetails.opening_hours || "Çalışma saatleri bilgisi yok",
            rating: placeDetails.rating || "N/A",
            user_ratings_total: placeDetails.user_ratings_total || 0,
            photos, // Fotoğrafları ekliyoruz
            reviews, // Yorumları ekliyoruz
        };

        res.json(formattedDetails);
    } catch (error) {
        console.error("Error fetching place details:", error.message);
        res.status(500).json({ error: "Failed to fetch place details" });
    }
});

// Sunucuyu Başlat
app.listen(PORT, () => {
    console.log(`Proxy server çalışıyor: http://localhost:${PORT}`);
});