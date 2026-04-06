FROM node:22.14.0-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy the rest of the app source code
COPY . .

# Expose the port the app runs in
EXPOSE 3000

# Build the app
RUN npm run build

# Serve the app
CMD ["npm", "run", "start:prod"]
