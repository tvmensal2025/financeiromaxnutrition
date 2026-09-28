FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV CALL_VOICE_STREAMING_ENABLED=true

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY src/ ./src/

EXPOSE 3000

CMD ["npm", "start"]
