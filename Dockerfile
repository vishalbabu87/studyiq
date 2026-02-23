FROM node:20-bookworm-slim

# Install Tesseract OCR so backend can run OCR fallback server-side.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=10000
ENV TESSERACT_PATH=/usr/bin/tesseract
ENV TESSERACT_LANG=eng

EXPOSE 10000

CMD ["sh", "-c", "node ./node_modules/@react-router/serve/dist/cli.js ./build/server/index.js"]
