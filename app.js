const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

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
            url: "http://localhost:3000",
        }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            }
        }
    },
    apis: ["./src/routes/*.js"]
};

const specs = swaggerJsdoc(options);

app.use("/api-docs/", swaggerUi.serve, swaggerUi.setup(specs));

// Routes
const userRoutes = require("./src/routes/user.route");
const carRoutes = require("./src/routes/car.route");

app.use("/api/users", userRoutes);
app.use("/api/cars", carRoutes);

module.exports = app;