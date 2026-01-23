const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI;

async function clearDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);

    const db = mongoose.connection.db;
    const collections = await db.collections();

    for (const collection of collections) {
      if (collection.collectionName !== "users") {
        await collection.deleteMany({});
        console.log(`Cleared collection: ${collection.collectionName}`);
      } else {
        console.log(`Skipped collection: users`);
      }
    }

    console.log("Database cleared successfully (users preserved)");
    process.exit(0);
  } catch (error) {
    console.error("Error clearing database:", error);
    process.exit(1);
  }
}

clearDatabase();
// Devlopment testing
// Step 1:  $env:MONGODB_URI="mongodb+srv://admin:PZAAa3NkQ72qHCQS@cluster0.bhey9yl.mongodb.net/"
// Step 2:  echo $env:MONGODB_URI  
// Step 3:  node scripts/clearDatabase.js

// Production 
// Step 1:  $env:MONGODB_URI="mongodb+srv://sharmaravi8567_db_user:boE8OtoMBwgg5LgV@cluster0.bfc5dph.mongodb.net/"
// Step 2:  echo $env:MONGODB_URI  
// Step 3:  node scripts/clearDatabase.js