const mysql = require('mysql2/promise');

// Load environment variables
require('dotenv').config({ path: './production.env' });

const config = {
  host: process.env.DB_HOST || '192.168.0.94',
  user: process.env.DB_USER || 'jitdhana',
  password: process.env.DB_PASSWORD || '<REDACTED_PASSWORD>',
  database: process.env.DB_NAME || 'esp_tracker',
  port: process.env.DB_PORT || 3306,
  connectTimeout: 10000,
  acquireTimeout: 10000,
  timeout: 10000
};

async function testConnection() {
  console.log('🔧 Database Configuration:');
  console.log('   Host:', config.host);
  console.log('   User:', config.user);
  console.log('   Database:', config.database);
  console.log('   Port:', config.port);
  console.log('');
  
  try {
    console.log('🔍 Attempting to connect...');
    const connection = await mysql.createConnection(config);
    console.log('✅ Connection successful!');
    console.log('🏠 Connected to:', connection.config.host);
    console.log('👤 User:', connection.config.user);
    
    // Test basic query
    console.log('🧪 Testing basic query...');
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query test passed:', rows[0].test === 1 ? 'PASSED' : 'FAILED');
    
    // Test database access
    console.log('📊 Testing database access...');
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('✅ Database access test passed');
    console.log('📋 Available tables:', tables.length);
    
    await connection.end();
    console.log('');
    console.log('🎉 All tests passed! Database is accessible.');
    return true;
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    console.log('');
    console.log('🔍 Error details:');
    console.log('   Code:', error.code);
    console.log('   Errno:', error.errno);
    console.log('   SQL State:', error.sqlState);
    console.log('');
    console.log('💡 Possible solutions:');
    console.log('1. Check if MySQL server is running on 192.168.0.94');
    console.log('2. Verify user jitdhana has permission to connect from this IP');
    console.log('3. Check firewall settings on 192.168.0.94');
    console.log('4. Run this MySQL command on 192.168.0.94:');
    console.log('   GRANT ALL PRIVILEGES ON esp_tracker.* TO "jitdhana"@"%" IDENTIFIED BY "<REDACTED_PASSWORD>";');
    console.log('   FLUSH PRIVILEGES;');
    console.log('5. Check MySQL bind-address in /etc/mysql/mysql.conf.d/mysqld.cnf');
    console.log('   Should be: bind-address = 0.0.0.0');
    return false;
  }
}

testConnection().then(success => {
  if (success) {
    console.log('🚀 Ready to start production server!');
    process.exit(0);
  } else {
    console.log('❌ Please fix database connection issues first.');
    process.exit(1);
  }
}).catch(error => {
  console.log('❌ Unexpected error:', error.message);
  process.exit(1);
}); 