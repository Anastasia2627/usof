FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 5000
CMD ["npm", "run", "start:hosted"]
