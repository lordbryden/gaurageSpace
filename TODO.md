# Image Path Fix TODO

## Plan Steps:
- [x] 1. Edit src/controllers/car.controller.js to save image paths as `/cars/filename` instead of `/uploads/cars/filename`.
- [ ] 2. Restart server.
- [ ] 3. Test uploading new car with images via POST /api/cars.
- [ ] 4. Verify in MongoDB that new cars have `/cars/...` paths.
- [ ] 5. Update frontend to use base URL + image path.
