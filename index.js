require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// Google Places API Key
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Middleware
app.use(express.json());

// Logging middleware for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Dinamik arama endpoint'i
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

        // Backend'ten dönen veri formatı kontrolü
        if (!response.data.candidates || !Array.isArray(response.data.candidates)) {
            return res.status(500).json({ error: "Unexpected response format from Google Places API" });
        }

        res.json(response.data.candidates);
    } catch (error) {
        console.error("Error fetching places:", error.message);
        res.status(500).json({ error: "Failed to fetch places" });
    }
});

// Mekan detayları endpoint'i
app.get("/api/places/details/:placeId", async (req, res) => {
    const placeId = req.params.placeId;
    if (!placeId) {
        return res.status(400).json({ error: "Place ID is required" });
    }

    try {
        const response = await axios.get("https://maps.googleapis.com/maps/api/place/details/json", {
            params: {
                place_id: placeId,
                fields: "name,formatted_address,formatted_phone_number,rating,geometry,user_ratings_total,opening_hours,photos,reviews",
                key: GOOGLE_PLACES_API_KEY,
            },
        });

        const placeDetails = response.data.result || {};

        // Fotoğrafları sınırla
        if (placeDetails.photos) {
            placeDetails.photos = placeDetails.photos.slice(0, 5).map(photo => ({
                photo_reference: photo.photo_reference,
                html_attributions: photo.html_attributions
            }));
        }

        res.json(placeDetails);
    } catch (error) {
        console.error("Error fetching place details:", error.message);
        res.status(500).json({ error: "Failed to fetch place details" });
    }
});

// Hatalı endpoint'ler için middleware
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint not found" });
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`Proxy server çalışıyor: http://localhost:${PORT}`);
});