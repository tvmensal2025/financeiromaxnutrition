FROM node:22-alpine

WORKDIR /app

# Resvg needs an installed font in Alpine or SVG text silently disappears.
RUN apk add --no-cache fontconfig ttf-dejavu

ENV NODE_ENV=production
ENV CALL_VOICE_STREAMING_ENABLED=true

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY src/ ./src/

EXPOSE 3000

CMD ["npm", "start"]
