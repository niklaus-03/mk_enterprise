const { MongoClient } = require('mongodb');
require('dotenv').config();

async function listDatabases() {
  const uri = "mongodb://127.0.0.1:27017";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const adminDb = client.db('admin').admin();
    const result = await adminDb.listDatabases();
    console.log("Databases:");
    result.databases.forEach(db => console.log(` - ${db.name}`));
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

listDatabases();
