import { MongoClient } from 'mongodb';
import 'dotenv/config';

const url = process.env.MONGO_CONNECTION_STRING;
const dbName = 'dubeau-dot-org';

let db;

async function connectToDatabase() {
    if (db) {
        return db;
    }

    const client = new MongoClient(url, {  });

    try {
        await client.connect();
        console.log('Connected successfully to MongoDB server');
        db = client.db(dbName);
        return db;
    } catch (err) {
        console.error('Failed to connect to MongoDB server', err);
        throw err;
    }
}

async function deleteDocument(collectionName, id) {
    const database = await connectToDatabase();
    const collection = database.collection(collectionName);
    try {
        const result = await collection.deleteOne({ _id: id });
        return result;
    } catch (err) {
        console.error(`Failed to delete document from ${collectionName}`, err);
        throw err;
    }
}


async function readCollection(collectionName) {
    const database = await connectToDatabase();
    const collection = database.collection(collectionName);
    try {
        const documents = await collection.find({}).toArray();
        return documents;
    } catch (err) {
        console.error(`Failed to retrieve documents from ${collectionName}`, err);
        throw err;
    }
}

async function writeToCollection(collectionName, document) {
    const database = await connectToDatabase();
    const collection = database.collection(collectionName);
    try {
        const result = await collection.insertOne(document);
        return result;
    } catch (err) {
        console.error(`Failed to insert document into ${collectionName}`, err);
        throw err;
    }
}

export { connectToDatabase, deleteDocument, readCollection, writeToCollection };