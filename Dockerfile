FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY client/package*.json ./client/
RUN npm install --prefix client

COPY . .
RUN npm run build

RUN mkdir -p /app/data

EXPOSE 3000
CMD ["node", "--experimental-sqlite", "server/index.js"]
