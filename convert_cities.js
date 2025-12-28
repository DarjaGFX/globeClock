import fs from 'fs';
import tz from 'tz-lookup';

try {
    const csv = fs.readFileSync('public/worldcities.csv', 'utf8');
    const lines = csv.split('\n');
    const cities = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',');
        if (cols.length < 3) continue;

        const name = cols[0].replace(/"/g, '');
        const lat = parseFloat(cols[1]);
        const lon = parseFloat(cols[2]);
        const pop = parseFloat(cols[7]) || 0;

        if (!isNaN(lat) && !isNaN(lon)) {
            // Get accurate Political Timezone ID
            let timezoneId = "UTC";
            try {
                timezoneId = tz(lat, lon);
            } catch (e) {
                // Fallback to geometric
                const offset = Math.round(lon / 15);
                const abs = Math.abs(offset);
                timezoneId = `Etc/GMT${offset > 0 ? '-' : '+'}${abs}`;
            }

            cities.push({
                name: name,
                lat: lat,
                lon: lon,
                population: pop,
                timezone: timezoneId, // IANA ID e.g. "Asia/Tehran"
                country: cols[3]
            });
        }
    }

    fs.writeFileSync('public/cities.json', JSON.stringify(cities));
    console.log(`Successfully converted ${cities.length} cities.`);
} catch (err) {
    console.error(err);
    process.exit(1);
}
