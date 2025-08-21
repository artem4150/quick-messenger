FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
ENV NODE_ENV=production
EXPOSE 5001
CMD ["npm", "start"]