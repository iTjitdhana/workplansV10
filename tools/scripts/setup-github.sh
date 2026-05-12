#!/bin/bash

# Setup Script for WorkplanV6 GitHub Repository
# Run this script after cloning the repository

echo "🚀 Setting up WorkplanV6 from GitHub..."
echo "================================================"

# Check if Node.js is installed
echo "📋 Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install npm first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo "✅ npm version: $(npm --version)"

echo ""
echo "📦 Installing Backend Dependencies..."
cd backend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install backend dependencies"
    exit 1
fi
echo "✅ Backend dependencies installed successfully"

echo ""
echo "📦 Installing Frontend Dependencies..."
cd ../frontend
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install frontend dependencies"
    exit 1
fi
echo "✅ Frontend dependencies installed successfully"

# Return to root directory
cd ..

echo ""
echo "🔧 Creating Environment Files..."

# Create Backend .env file
cat > backend/.env << EOF
NODE_ENV=production
DB_HOST=192.168.0.94
DB_USER=jitdhana
DB_PASSWORD=<REDACTED_PASSWORD>
DB_NAME=esp_tracker
DB_PORT=3306
PORT=3101
EOF
echo "✅ Backend .env file created"

# Create Frontend .env.local file
cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:3101/api
EOF
echo "✅ Frontend .env.local file created"

echo ""
echo "📋 Database Setup Instructions:"
echo "1. Create MySQL database: CREATE DATABASE esp_tracker;"
echo "2. Import schema: mysql -u root -p esp_tracker < backend/esp_tracker.sql"
echo "3. Update database credentials in backend/.env if needed"

echo ""
echo "🚀 Quick Start Commands:"
echo "1. Start Backend: cd backend && npm start"
echo "2. Start Frontend: cd frontend && npm run dev"
echo "3. Or use: ./quick-start.sh"

echo ""
echo "🌐 Access URLs:"
echo "- Frontend: http://localhost:3011"
echo "- Backend API: http://localhost:3101/api"

echo ""
echo "✅ Setup completed successfully!"
echo "🎉 WorkplanV6 is ready to use!"

# Ask if user wants to start the servers
echo ""
read -p "❓ Do you want to start the servers now? (y/n): " response

if [[ $response =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Starting servers..."
    
    # Start Backend
    echo "Starting Backend..."
    cd backend
    npm start &
    BACKEND_PID=$!
    
    # Wait a moment
    sleep 3
    
    # Start Frontend
    echo "Starting Frontend..."
    cd ../frontend
    npm run dev &
    FRONTEND_PID=$!
    
    echo ""
    echo "✅ Servers started!"
    echo "🌐 Frontend: http://localhost:3011"
    echo "🔧 Backend: http://localhost:3101"
    echo ""
    echo "Press Ctrl+C to stop all servers"
    
    # Wait for user to stop
    wait
else
    echo ""
    echo "📝 You can start the servers manually later using:"
    echo "   ./quick-start.sh"
fi

echo ""
echo "🎯 Setup complete! Happy coding! 🚀" 