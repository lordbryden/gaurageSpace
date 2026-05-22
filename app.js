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
        // Swagger UI lets the user pick a server from this dropdown when
        // hitting "Try it out". Keeping localhost as one option is handy for
        // local dev, but "/" (relative — same origin as the docs page) is
        // what makes the deployed server work without code changes.
        servers: [
            ...(process.env.API_BASE_URL ? [{ url: process.env.API_BASE_URL, description: "Configured server" }] : []),
            { url: "/", description: "Same origin as Swagger UI" },
            { url: "http://localhost:3000", description: "Local dev" },
        ],
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
const advertRoutes = require("./src/routes/advert.route");
const bookingRoutes = require("./src/routes/booking.route");
const ratingRoutes = require("./src/routes/rating.route");
const auditRoutes = require("./src/routes/audit.route");
const settingRoutes = require("./src/routes/setting.route");

app.use("/api/users", userRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/adverts", advertRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/ratings", ratingRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/settings", settingRoutes);

module.exports = app;