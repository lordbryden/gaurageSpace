const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Swagger Config
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "My API",
            version: "1.0.0",
            description: "API Documentation",
        },
        servers: [{
            url: "http://localhost:5000",
        }, ],
    },
    apis: ["./src/routes/*.js"], // path to route files
};

const specs = swaggerJsdoc(options);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Routes
const userRoutes = require("./src/routes/user.route");


app.use("/api/users", userRoutes);

module.exports = app;