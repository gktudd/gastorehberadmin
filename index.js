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
                language: "tr", // Yorumların Türkçe olarak alınmasını zorlar
                key: GOOGLE_PLACES_API_KEY,
            },
        });

        const placeDetails = response.data.result || {};

        // Fotoğrafları sınırlama ve URL'leri oluşturma
        const photos = (placeDetails.photos || []).slice(0, 5).map((photo) => ({
            url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`,
            attributions: photo.html_attributions || [],
        }));

        // İlk 10 yorumu al ve zaman bilgisini ekle
        const reviews = (placeDetails.reviews || []).slice(0, 10).map((review) => ({
            author: review.author_name,
            rating: review.rating,
            text: review.text,
            time: review.relative_time_description, // "Kaç zaman geçti" bilgisi
            original_language: review.language, // Orijinal dil bilgisi
        }));

        const formattedDetails = {
            name: placeDetails.name,
            address: placeDetails.formatted_address,
            phone: placeDetails.formatted_phone_number,
            url: placeDetails.url,
            geometry: placeDetails.geometry,
            opening_hours: placeDetails.opening_hours || "Not available",
            rating: placeDetails.rating || "N/A",
            user_ratings_total: placeDetails.user_ratings_total || 0,
            photos, // Fotoğrafları URL'ler ile birlikte ekliyoruz
            reviews, // İlk 10 yorumu ekliyoruz
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