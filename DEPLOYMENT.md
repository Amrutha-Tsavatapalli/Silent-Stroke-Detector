# Deployment Guide

## Local Development

### Quick Start
```bash
pip install -r requirements.txt
streamlit run app_live.py
```

### With Virtual Environment
```bash
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
streamlit run app_live.py
```

## Cloud Deployment

### Streamlit Cloud (Easiest)

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

2. **Deploy on Streamlit Cloud**
- Go to https://share.streamlit.io
- Connect your GitHub repo
- Select `app_live.py` as main file
- Click "Deploy"

3. **Configure Secrets** (if using backend)
```toml
# .streamlit/secrets.toml
BACKEND_API_URL = "https://your-backend.com"
ALERT_THRESHOLD = "0.70"
```

### Heroku

1. **Create Procfile**
```
web: streamlit run app_live.py --server.port $PORT --server.address 0.0.0.0
```

2. **Create runtime.txt**
```
python-3.9.16
```

3. **Deploy**
```bash
heroku create your-app-name
git push heroku main
heroku open
```

### Railway

1. **Create railway.json**
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "streamlit run app_live.py --server.port $PORT --server.address 0.0.0.0",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

2. **Deploy**
```bash
railway login
railway init
railway up
```

### Docker

1. **Create Dockerfile**
```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    libportaudio2 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8501

# Health check
HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health

# Run app
CMD ["streamlit", "run", "app_live.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

2. **Create docker-compose.yml**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8501:8501"
    environment:
      - BACKEND_API_URL=http://backend:8080
      - ALERT_THRESHOLD=0.70
    volumes:
      - ./data:/app/data
    depends_on:
      - backend
  
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/stroke_db
    depends_on:
      - db
  
  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=stroke_db
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

3. **Build and Run**
```bash
docker-compose up --build
```

### AWS EC2

1. **Launch EC2 Instance**
- AMI: Ubuntu 22.04
- Instance type: t2.medium (minimum)
- Security group: Allow ports 22, 8501

2. **SSH and Setup**
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Python
sudo apt install python3-pip python3-venv -y

# Install system dependencies
sudo apt install libsndfile1 libportaudio2 ffmpeg -y

# Clone repo
git clone <your-repo-url>
cd Silent-Stroke-Detector

# Setup virtual environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run with nohup
nohup streamlit run app_live.py --server.port 8501 --server.address 0.0.0.0 &
```

3. **Setup Nginx (Optional)**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8501;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Google Cloud Run

1. **Create Dockerfile** (same as above)

2. **Deploy**
```bash
# Build and push
gcloud builds submit --tag gcr.io/PROJECT_ID/stroke-detector

# Deploy
gcloud run deploy stroke-detector \
  --image gcr.io/PROJECT_ID/stroke-detector \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Backend Deployment

### Node.js Backend (Railway)

1. **Navigate to backend**
```bash
cd backend
```

2. **Create railway.json**
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

3. **Deploy**
```bash
railway login
railway init
railway up
```

4. **Add PostgreSQL**
```bash
railway add postgresql
```

5. **Get DATABASE_URL**
```bash
railway variables
```

### Backend on Heroku

```bash
cd backend
heroku create your-backend-name
heroku addons:create heroku-postgresql:hobby-dev
git push heroku main
```

## Environment Variables

### Frontend (.env)
```bash
BACKEND_API_URL=https://your-backend.com
PERSIST_TO_BACKEND=true
ALERT_THRESHOLD=0.70
```

### Backend (.env)
```bash
PORT=8080
DATABASE_URL=postgresql://user:pass@host:5432/db
ALERT_THRESHOLD=0.70
NODE_ENV=production
```

## Performance Optimization

### For Production

1. **Optimize requirements.txt**
```txt
# Remove dev dependencies
streamlit==1.44.0
numpy==1.26.0
opencv-python-headless==4.10.0  # Headless version
mediapipe==0.10.0
librosa==0.10.2
sounddevice==0.4.6
```

2. **Configure Streamlit**
```toml
# .streamlit/config.toml
[server]
maxUploadSize = 10
enableCORS = false
enableXsrfProtection = true

[browser]
gatherUsageStats = false

[theme]
primaryColor = "#FF4B4B"
backgroundColor = "#FFFFFF"
secondaryBackgroundColor = "#F0F2F6"
textColor = "#262730"
```

3. **Add caching**
```python
@st.cache_resource
def load_models():
    return StrokeDetectionRuntime(config)
```

## Monitoring

### Health Check Endpoint

Add to `app_live.py`:
```python
import streamlit as st

# Health check
if st.query_params.get("health") == "check":
    st.write("OK")
    st.stop()
```

### Logging

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('app.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)
```

### Error Tracking (Sentry)

```python
import sentry_sdk

sentry_sdk.init(
    dsn="your-sentry-dsn",
    traces_sample_rate=1.0
)
```

## Security

### HTTPS Setup (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Environment Secrets

Never commit:
- `.env` files
- API keys
- Database credentials
- Private keys

Use:
- Streamlit secrets
- Environment variables
- Secret managers (AWS Secrets Manager, etc.)

### CORS Configuration

```python
# backend/src/index.js
const cors = require('cors');

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8501',
  credentials: true
}));
```

## Scaling

### Horizontal Scaling

1. **Load Balancer** (Nginx)
```nginx
upstream streamlit_backend {
    server app1:8501;
    server app2:8501;
    server app3:8501;
}

server {
    location / {
        proxy_pass http://streamlit_backend;
    }
}
```

2. **Docker Swarm**
```bash
docker swarm init
docker stack deploy -c docker-compose.yml stroke-detector
docker service scale stroke-detector_app=3
```

3. **Kubernetes**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stroke-detector
spec:
  replicas: 3
  selector:
    matchLabels:
      app: stroke-detector
  template:
    metadata:
      labels:
        app: stroke-detector
    spec:
      containers:
      - name: app
        image: your-image:latest
        ports:
        - containerPort: 8501
```

### Vertical Scaling

Recommended specs:
- **Development:** 2 CPU, 4GB RAM
- **Production:** 4 CPU, 8GB RAM
- **High traffic:** 8 CPU, 16GB RAM

## Cost Estimation

### Free Tier Options
- **Streamlit Cloud:** Free for public repos
- **Railway:** $5/month free credit
- **Heroku:** Free tier (limited hours)

### Paid Options
- **AWS EC2 t2.medium:** ~$30/month
- **Google Cloud Run:** Pay per use (~$10-50/month)
- **Railway Pro:** $20/month
- **Heroku Hobby:** $7/month

## Maintenance

### Updates
```bash
# Update dependencies
pip install --upgrade -r requirements.txt

# Update Streamlit
pip install --upgrade streamlit

# Update MediaPipe
pip install --upgrade mediapipe
```

### Backups
```bash
# Database backup
pg_dump $DATABASE_URL > backup.sql

# Restore
psql $DATABASE_URL < backup.sql
```

### Monitoring
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Configure alerts for downtime
- Monitor resource usage
- Track error rates

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
lsof -ti:8501 | xargs kill -9
```

**Permission denied:**
```bash
sudo chown -R $USER:$USER .
```

**Out of memory:**
- Increase instance size
- Add swap space
- Optimize code

**Slow performance:**
- Enable caching
- Optimize image processing
- Use CDN for static assets

## Support

For deployment issues:
- Check logs: `streamlit run app_live.py --logger.level=debug`
- Review documentation
- Open GitHub issue
- Contact support

---

**Ready to deploy? Start with Streamlit Cloud for easiest setup!** 🚀
