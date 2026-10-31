/* make-placeholders.js – erzeugt SVG-Platzhalter und die Bildliste (images/IMAGE-LIST.md).
   Aufruf: node tools/make-placeholders.js
   Die Platzhalter werden später durch echte .webp-Fotos mit gleichem Namen ersetzt. */
const fs = require("fs");
const path = require("path");

const warm = ["#F3E3C8", "#D8C8AE", "#8FB3C4"];      // Afternoon
const sunset = ["#E8A15A", "#7A3E2B", "#10222E"];    // Sunset
const spa = ["#EDE6D8", "#D8C8AE", "#B9B2A3"];       // Wellness

// [Datei, Breite, Höhe, Farben, Beschreibung, Bild-Prompt]
const images = [
  ["hero/hero-home", 1920, 1080, warm, "Hotel terrace with sea view", "Wide photo of a whitewashed Greek hotel terrace at about 6 pm, warm natural sunlight, light wood furniture, sand-coloured cushions, calm Aegean sea in the background, no people, photorealistic, 16:9"],
  ["hero/welcome-1", 960, 1200, warm, "Hotel entrance in natural stone", "Portrait photo of a hotel entrance in natural stone with pale wood door and olive tree, late afternoon light, photorealistic, 4:5"],
  ["hero/welcome-2", 800, 800, warm, "Detail of linen and wood", "Close-up of linen bedding next to a light wooden bedside table, soft window light, sand tones, photorealistic, 1:1"],
  ["rooms/room-garden-1", 1200, 960, warm, "Garden room interior", "Bright hotel room with stone walls, light oak floor, sand-coloured furniture, doors open to a garden, late afternoon light, photorealistic, 5:4"],
  ["rooms/room-sea-1", 1200, 960, warm, "Sea view room interior", "Bright hotel room with a large window and view of the sea, white linen bed, light wood, warm sunlight, photorealistic, 5:4"],
  ["rooms/room-suite-1", 1200, 960, warm, "Aegean suite living area", "Spacious suite with a lounge area, natural stone wall, light wood, big window to the sea, photorealistic, 5:4"],
  ["rooms/room-garden-2", 1200, 960, warm, "Garden room bathroom", "Bathroom with natural stone, light wood vanity and a rain shower, soft daylight, photorealistic, 5:4"],
  ["rooms/room-garden-3", 1200, 960, warm, "Garden room terrace", "Small private terrace with two chairs and a garden view, late afternoon light, photorealistic, 5:4"],
  ["rooms/room-sea-2", 1200, 960, warm, "Sea view balcony", "Balcony with a small table and the Aegean sea in the background, warm light, photorealistic, 5:4"],
  ["rooms/room-sea-3", 1200, 960, warm, "Sea view bathroom", "Bright bathroom with natural stone and a window to the sea, photorealistic, 5:4"],
  ["rooms/room-suite-2", 1200, 960, warm, "Suite bedroom", "Suite bedroom with white linen, light oak headboard and sea view, photorealistic, 5:4"],
  ["rooms/room-suite-3", 1200, 960, warm, "Suite terrace", "Large suite terrace with lounge furniture above the sea, photorealistic, 5:4"],
  ["hero/greece-band", 1920, 1080, warm, "Greek coast with white chapel", "Wide landscape of a Greek coastline with a small white chapel, olive trees and turquoise sea, golden afternoon light, photorealistic, 16:9"],
  ["experiences/sunset-dining", 900, 1200, sunset, "Sunset dining on the terrace", "Restaurant terrace at sunset, dark walnut tables, candles, amber light, sea horizon, photorealistic, 3:4"],
  ["experiences/evening-lounge", 900, 1200, sunset, "Evening lounge", "Dark walnut lounge bar with warm amber lamps, deep blue accents, glass doors to the sea at dusk, no people, photorealistic, 3:4"],
  ["experiences/private-moments", 900, 1200, sunset, "Private table by the sea", "A single candlelit table for two on a stone terrace above the sea at dusk, photorealistic, 3:4"],
  ["experiences/exp-hero", 1920, 1080, sunset, "Terrace at sunset", "Wide dramatic photo of a Greek hotel terrace at sunset, dark walnut furniture, candles, deep amber sky over the sea, photorealistic, 16:9"],
  ["experiences/exp-dining-wide", 1920, 1080, sunset, "Long dinner table at sunset", "Long dinner table on a stone terrace at sunset, candles and glasses, amber light, sea horizon, photorealistic, 16:9"],
  ["experiences/exp-island-1", 1200, 800, sunset, "Small harbour at dusk", "Small Greek island harbour at dusk with fishing boats and warm lights, photorealistic, 3:2"],
  ["experiences/exp-island-2", 1200, 800, sunset, "Boat on calm water", "Wooden boat on calm Aegean water at golden hour, photorealistic, 3:2"],
  ["experiences/exp-island-3", 1200, 800, sunset, "Whitewashed village at dusk", "Whitewashed island village with lit windows at dusk, photorealistic, 3:2"],
  ["experiences/exp-romantic", 1200, 1500, sunset, "Couple's table with candles", "Intimate table for two with candles and flowers on a terrace at dusk, no people, photorealistic, 4:5"],
  ["experiences/exp-seaview", 1920, 900, sunset, "Sea view from the lounge", "View of the sea at sunset through large lounge windows with dark walnut frames, photorealistic, 21:10"],
  ["restaurant/dining-terrace", 1200, 900, warm, "Restaurant terrace by day", "Mediterranean restaurant terrace with light wooden tables, white linen, olive trees, sea view, photorealistic, 4:3"],
  ["restaurant/restaurant-hero", 1920, 1080, warm, "Restaurant terrace", "Wide photo of a Mediterranean restaurant terrace with light wooden tables and sea view, warm afternoon light, photorealistic, 16:9"],
  ["restaurant/rest-1", 1200, 900, warm, "Plated Mediterranean dish", "Elegantly plated Mediterranean seafood dish on a light stone plate, natural light, photorealistic, 4:3"],
  ["restaurant/rest-2", 1200, 900, sunset, "Terrace at sunset", "Restaurant terrace at sunset with candles on dark wooden tables, photorealistic, 4:3"],
  ["restaurant/rest-3", 1200, 900, warm, "Restaurant interior", "Restaurant interior with warm wood, stone wall and large windows, photorealistic, 4:3"],
  ["restaurant/rest-4", 1200, 900, sunset, "Dessert and wine", "Dessert and a glass of wine on a dark wooden table in amber candlelight, photorealistic, 4:3"],
  ["wellness/spa-1", 800, 1333, spa, "Spa with natural stone", "Spa relaxation area with natural stone walls, soft towels, warm daylight, calm, photorealistic, 3:5"],
  ["wellness/pool-1", 1000, 1000, spa, "Pool in the afternoon", "Infinity pool with sea view, light stone deck, sun loungers, late afternoon light, photorealistic, 1:1"],
  ["wellness/wellness-hero", 1920, 1080, spa, "Spa with natural stone", "Wide photo of a calm spa area with natural stone walls, light wood, soft towels and warm daylight, photorealistic, 16:9"],
  ["wellness/spa-2", 1200, 900, spa, "Treatment room", "Quiet treatment room with a massage table, stone wall and warm light, photorealistic, 4:3"],
  ["wellness/pool-2", 1200, 800, spa, "Pool with sea view", "Pool terrace with sea view in the late afternoon, light stone, photorealistic, 3:2"],
  ["wellness/pool-3", 1200, 800, spa, "Poolside loungers", "Poolside sun loungers with white towels and olive trees, photorealistic, 3:2"],
  ["wellness/relax-1", 1000, 1250, spa, "Relaxation room", "Relaxation room with daybeds, linen curtains and soft daylight, photorealistic, 4:5"],
  ["gallery/gallery-1", 1200, 1200, warm, "Terrace at golden hour", "Hotel terrace at golden hour with sea view, photorealistic, square"],
  ["gallery/gallery-2", 900, 600, warm, "Breakfast table", "Breakfast table with fruit, yoghurt and honey on a light wooden table, window light, photorealistic, 3:2"],
  ["gallery/gallery-3", 900, 600, warm, "Courtyard with olive tree", "Whitewashed courtyard with an olive tree and stone path, photorealistic, 3:2"],
  ["gallery/gallery-4", 600, 1200, warm, "Stairway in white stone", "Narrow whitewashed stairway with blue door and bougainvillea, photorealistic, 1:2"],
  ["gallery/gallery-5", 1200, 600, sunset, "Sea at sunset", "The Aegean sea at sunset seen from a hotel balcony, photorealistic, 2:1"],
];

let list = "# Bildliste für Hotel Ismini\n\nAktuell stehen in `images/` **SVG-Platzhalter**. So tauschst du sie gegen echte Fotos aus:\n\n1. Lege dein Foto (JPG, PNG oder WebP) unter `images-src/` ab, mit **demselben Ordner und Namen** wie in der Tabelle, zum Beispiel `images-src/hero/hero-home.jpg`.\n2. Führe `npm run images` aus. Das erzeugt AVIF und WebP in 480 bis 1920 px und stellt alle Seiten auf `<picture>` mit `srcset` um.\n3. Fertig. Fehlt ein Foto, bleibt der Platzhalter sichtbar.\n\nGröße und Seitenverhältnis unten möglichst einhalten (Originale gern größer, mindestens 1920 px breit bei Vollbild-Motiven).\n\n";
list += "| Datei | Größe | Motiv | Prompt für KI-Bild |\n|---|---|---|---|\n";

for (const [file, w, h, c, label, prompt] of images) {
  const out = path.join("images", file + ".svg");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Placeholder: ${label}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="0.55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <text x="50%" y="50%" text-anchor="middle" font-family="Georgia, serif" font-size="${Math.round(Math.min(w, h) / 22)}" fill="#ffffff" fill-opacity="0.85">Placeholder: ${label}</text>
</svg>\n`;
  fs.writeFileSync(out, svg);
  list += `| images/${file}.webp | ${w}x${h} | ${label} | ${prompt} |\n`;
}
fs.writeFileSync("images/IMAGE-LIST.md", list);
console.log(images.length + " Platzhalter erzeugt");
