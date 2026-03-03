#!/bin/bash

# StoryWeaver Deployment Script
set -e

echo "🚀 Starting StoryWeaver deployment..."

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first."
    exit 1
fi

# Check if terraform is installed
if ! command -v terraform &> /dev/null; then
    echo "❌ terraform is not installed. Please install it first."
    exit 1
fi

# Load environment variables
source .env

echo "📦 Building backend Docker image..."
cd backend
docker build -t gcr.io/${GOOGLE_CLOUD_PROJECT}/storyweaver-backend:latest .

echo "⬆️ Pushing to Google Container Registry..."
docker push gcr.io/${GOOGLE_CLOUD_PROJECT}/storyweaver-backend:latest

cd ..

echo "🏗️ Deploying infrastructure with Terraform..."
cd infrastructure
terraform init
terraform apply -auto-approve \
  -var="project_id=${GOOGLE_CLOUD_PROJECT}" \
  -var="region=${GOOGLE_CLOUD_LOCATION}"

# Get Cloud Run URL
CLOUD_RUN_URL=$(terraform output -raw cloud_run_url)
cd ..

echo "📝 Updating frontend configuration..."
cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=${CLOUD_RUN_URL}
NEXT_PUBLIC_WS_URL=${CLOUD_RUN_URL/\/\//ws:\/\/}
EOF

echo "📦 Building frontend..."
cd frontend
npm install
npm run build

echo "✅ Deployment complete!"
echo "🌐 Backend URL: ${CLOUD_RUN_URL}"
echo "🎨 Frontend is ready for deployment to Vercel/Netlify"
echo ""
echo "Next steps:"
echo "1. Deploy frontend to your hosting service"
echo "2. Set environment variables in your frontend hosting"
echo "3. Test the application"