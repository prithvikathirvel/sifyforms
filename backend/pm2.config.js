module.exports = {
    apps: [{
      name: "form-builder-service",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
        // Add other environment variables here
        MONGO_URI: "mongodb://localhost:27017",
        MONGO_DB_NAME: "subscription",
        FIRESTORE_PROJECT_ID: "test-proj",
        DB_TYPE: "mysql",
        MYSQL_HOST: "localhost",
        MYSQL_USER: "root",
        MYSQL_PASSWORD: "sIfyModErniZe@97531",
        MYSQL_DB: "formbuilder",
        MYSQL_PORT: 3306,
        PORT: 12001,
        BASE_URL: "https://apidev.sifymodernization.digital",
        NODE_ENV: "DEV"
      },
      env_file: ".env"  // This will load variables from .env
    }]
}
