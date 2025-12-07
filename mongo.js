const { MongoClient } = require('mongodb');

const DEFAULT_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/andes';
const DEFAULT_DB_NAME = process.env.MONGODB_DB || 'andes';

let client;
let db;

async function connectMongo() {
  if (db) return db;

  const uri = DEFAULT_URI;
  const dbName = DEFAULT_DB_NAME;

  client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  await client.connect();
  db = client.db(dbName);
  console.log(`✅ Conectado a MongoDB en ${uri}, DB: ${dbName}`);
  return db;
}

async function getDb() {
  if (!db) {
    await connectMongo();
  }
  return db;
}

module.exports = {
  connectMongo,
  getDb,
};
