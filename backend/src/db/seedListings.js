// Populates the listings table with the 15 properties already live on the
// static properties.html page, so the database starts with real data instead
// of empty. Safe to re-run — clears and re-inserts. Run with: npm run seed:listings
require('dotenv').config();
const { pool } = require('./pool');

const completedProjects = [
  { title: 'Apartment in Sofia Centre', status: 'Delivered', city: 'Sofia', area: 'Centre', type: 'Residential', bedrooms: 2, tier: 'Essential', price: '€135k', year: '2024', imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=70', imageAlt: 'Apartment in Sofia Centre — Sofia · Centre · 2024', description: 'A compact city-centre apartment, finished and tenanted within weeks of handover.', featured: true, sortOrder: 1 },
  { title: 'Sea-View Loft in Varna', status: 'Delivered', city: 'Varna', area: 'Sea Garden', type: 'Residential', bedrooms: 2, tier: 'Signature', price: '€110k', year: '2024', imageUrl: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=70', imageAlt: 'Sea-View Loft in Varna — Varna · Sea Garden · 2024', description: 'A coastal loft with sweeping sea views, furnished for premium seasonal rental.', featured: true, sortOrder: 2 },
  { title: 'Alpine Chalet in Bansko', status: 'Delivered', city: 'Bansko', area: 'Alpine', type: 'Residential', bedrooms: 1, tier: 'Essential', price: '€85k', year: '2023', imageUrl: 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?auto=format&fit=crop&w=800&q=70', imageAlt: 'Alpine Chalet in Bansko — Bansko · Alpine · 2023', description: 'Ski-in ski-out apartment, efficiently finished for peak-season rental income.', featured: true, sortOrder: 3 },
  { title: 'Old Town Family Home', status: 'Delivered', city: 'Plovdiv', area: 'Old Town', type: 'Residential', bedrooms: 3, tier: 'Signature', price: '€165k', year: '2023', imageUrl: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=800&q=70', imageAlt: 'Old Town Family Home — Plovdiv · Old Town · 2023', description: 'Two-bedroom apartment finished and furnished for a family relocating from abroad.', featured: false, sortOrder: 4 },
  { title: 'Black Sea Villa', status: 'Delivered', city: 'Sozopol', area: 'Coastal', type: 'House', bedrooms: 4, tier: 'Bespoke', price: '€245k', year: '2024', imageUrl: 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=800&q=70', imageAlt: 'Black Sea Villa — Sozopol · Coastal · 2024', description: 'A four-bedroom seafront villa, restored and furnished as a private family retreat.', featured: false, sortOrder: 5 },
  { title: 'Boutique Office in Lozenets', status: 'Delivered', city: 'Sofia', area: 'Lozenets', type: 'Commercial', bedrooms: 0, tier: 'Signature', price: '€320k', year: '2023', imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=70', imageAlt: 'Boutique Office in Lozenets — Sofia · Lozenets · 2023', description: 'A boutique office fit-out, delivered turnkey and leased within a month.', featured: false, sortOrder: 6 },
].map((d) => ({ ...d, category: 'completed' }));

const availableListings = [
  { title: 'Two-Bed New-Build', status: 'For Sale', city: 'Sofia', area: 'Lozenets', type: 'New Build', bedrooms: 2, price: '€142,000', imageUrl: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=70', imageAlt: 'Two-Bed New-Build for sale — Sofia · Lozenets', description: 'Under Construction · Delivery Q4 2026 · 78 m²', sortOrder: 7 },
  { title: 'Renovated City Apartment', status: 'For Sale', city: 'Sofia', area: 'Centre', type: 'Residential', bedrooms: 1, price: '€118,000', imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=70', imageAlt: 'Renovated City Apartment for sale — Sofia · Centre', description: 'Move-in Ready · 52 m²', sortOrder: 8 },
  { title: 'Sea-View Apartment', status: 'For Sale', city: 'Varna', area: 'Sea Garden', type: 'Vacation Rental', bedrooms: 2, price: '€96,000', imageUrl: 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=800&q=70', imageAlt: 'Sea-View Apartment for sale — Varna · Sea Garden', description: 'Move-in Ready · 68 m²', sortOrder: 9 },
  { title: 'Ski-In Ski-Out Chalet', status: 'For Sale', city: 'Bansko', area: 'Alpine', type: 'Vacation Rental', bedrooms: 1, price: '€89,000', imageUrl: 'https://images.unsplash.com/photo-1518156677180-95a2893f3e9f?auto=format&fit=crop&w=800&q=70', imageAlt: 'Ski-In Ski-Out Chalet for sale — Bansko · Alpine', description: 'Move-in Ready · 45 m²', sortOrder: 10 },
  { title: 'Old Town Family Townhouse', status: 'For Sale', city: 'Plovdiv', area: 'Old Town', type: 'Residential', bedrooms: 3, price: '€175,000', imageUrl: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=800&q=70', imageAlt: 'Old Town Family Townhouse for sale — Plovdiv · Old Town', description: 'Move-in Ready · 140 m²', sortOrder: 11 },
  { title: 'Coastal Villa, Off-Plan', status: 'For Sale', city: 'Sozopol', area: 'Coastal', type: 'New Build', bedrooms: 4, price: '€280,000', imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=70', imageAlt: 'Coastal Villa, Off-Plan for sale — Sozopol · Coastal', description: 'Off-Plan · Delivery Q2 2027 · 220 m²', sortOrder: 12 },
  { title: 'Boutique Office Space', status: 'For Sale', city: 'Sofia', area: 'Lozenets', type: 'Commercial', bedrooms: 0, price: '€295,000', imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=70', imageAlt: 'Boutique Office Space for sale — Sofia · Lozenets', description: 'Move-in Ready · 180 m²', sortOrder: 13 },
  { title: 'New-Build Penthouse', status: 'For Sale', city: 'Sofia', area: 'Ivan Vazov', type: 'New Build', bedrooms: 3, price: '€225,000', imageUrl: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=800&q=70', imageAlt: 'New-Build Penthouse for sale — Sofia · Ivan Vazov', description: 'Under Construction · Delivery Q1 2027 · 130 m²', sortOrder: 14 },
  { title: 'Mountain-View Apartment', status: 'For Sale', city: 'Bansko', area: 'Alpine', type: 'Vacation Rental', bedrooms: 1, price: '€72,000', imageUrl: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=70', imageAlt: 'Mountain-View Apartment for sale — Bansko · Alpine', description: 'Move-in Ready · 40 m²', sortOrder: 15 },
].map((d) => ({ ...d, category: 'listing' }));

async function seed() {
  const all = [...completedProjects, ...availableListings];

  await pool.query('DELETE FROM listings');

  for (const d of all) {
    await pool.query(
      `INSERT INTO listings
        (title, category, status, city, area, type, bedrooms, tier, price, year,
         image_url, image_alt, description, featured, published, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        d.title, d.category, d.status, d.city, d.area, d.type, d.bedrooms,
        d.tier || null, d.price || null, d.year || null,
        d.imageUrl, d.imageAlt, d.description || null,
        d.featured || false, true, d.sortOrder,
      ]
    );
  }

  console.log(`Seeded ${all.length} listings.`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Failed to seed listings:', err);
  process.exit(1);
});
