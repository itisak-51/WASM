FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache git

RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
