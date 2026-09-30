require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');

// Allow deployments to override the DNS resolvers used for MongoDB SRV lookups.
const configuredDnsServers = (process.env.MONGODB_DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
if (configuredDnsServers.length) {
  try {
    dns.setServers(configuredDnsServers);
  } catch (e) {
    console.warn(`[TaskFlow DB] Warning: Could not set custom DNS servers: ${e.message}`);
  }
}

const connectDB = async () => {
  const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskflow';
  try {
    const conn = await mongoose.connect(connUri, {
      serverSelectionTimeoutMS: 10000
    });
    console.log(`\n========================================`);
    console.log(`✅ [TaskFlow DB] MongoDB Connected Successfully!`);
    console.log(`📦 Database Host: ${conn.connection.host}`);
    console.log(`========================================\n`);
    return conn;
  } catch (error) {
    const isSslAlert = error.message.includes('SSL alert') || error.message.includes('tlsv1 alert internal error');
    const isDnsError = error.message.includes('querySrv');
    const isBadAuth = error.message.includes('bad auth') || error.message.includes('Authentication failed');

    console.error(`[MongoDB] Connection failed (${error.name}): ${error.message}`);

    if (isBadAuth) {
      console.error('[MongoDB] Check the credentials in MONGODB_URI.');
    } else if (isSslAlert) {
      console.error('[MongoDB] Check that this network is allowed in the Atlas IP access list.');
    } else if (isDnsError) {
      console.error('[MongoDB] SRV lookup failed; check DNS or MONGODB_DNS_SERVERS.');
    }

    return null;
  }
};

module.exports = connectDB;
