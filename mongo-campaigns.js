const { getDb } = require('./mongo');

const COLLECTION_NAME = 'campaigns';

async function getCollection() {
  const db = await getDb();
  return db.collection(COLLECTION_NAME);
}

/**
 * Inserta una campaña individual
 */
async function insertCampaign(campaign) {
  const collection = await getCollection();
  const result = await collection.insertOne(campaign);
  return { ...campaign, _id: result.insertedId };
}

/**
 * Inserta múltiples campañas (por ejemplo, varias fechas o variaciones)
 */
async function insertManyCampaigns(campaigns) {
  if (!campaigns || campaigns.length === 0) return { insertedCount: 0 };
  const collection = await getCollection();
  const result = await collection.insertMany(campaigns);
  return { insertedCount: result.insertedCount };
}

/**
 * Obtiene todas las campañas para una fecha específica (YYYY-MM-DD)
 */
async function getCampaignsByDate(campaignDate) {
  const collection = await getCollection();
  return collection
    .find({ campaignDate })
    .sort({ uploadedAt: 1 })
    .toArray();
}

/**
 * Obtiene campañas en un rango de fechas inclusive (YYYY-MM-DD)
 */
async function getCampaignsByDateRange(startDate, endDate) {
  const collection = await getCollection();
  return collection
    .find({ campaignDate: { $gte: startDate, $lte: endDate } })
    .sort({ campaignDate: 1, uploadedAt: 1 })
    .toArray();
}

module.exports = {
  insertCampaign,
  insertManyCampaigns,
  getCampaignsByDate,
  getCampaignsByDateRange,
};
