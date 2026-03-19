# Car Image Upload Implementation
Track progress on enabling image uploads for car creation.

## TODO Steps
- [x] 1. Install multer (`npm install multer`)
- [x] 2. Create uploads/cars directory (`mkdir -p uploads/cars`)
- [x] 3. Create src/middleware/multer.js (multer config)
- [ ] 4. Update src/routes/car.route.js (add multer to POST /cars and /park)
- [ ] 5. Update src/controllers/car.controller.js (handle req.files in createCar and parkCar)
- [x] 6. Update app.js (add express.static('uploads'))
- [ ] 7. Test endpoint with curl or Postman (multipart/form-data)

## Progress
All steps complete except testing. Restart server with `npm run dev`.
