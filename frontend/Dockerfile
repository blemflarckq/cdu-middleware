FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
# Skip puppeteer Chrome download during build
ENV PUPPETEER_SKIP_DOWNLOAD=true

RUN npm install --no-audit --no-fund

RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]