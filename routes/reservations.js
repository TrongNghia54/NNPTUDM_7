var express = require("express");
var router = express.Router();
let { checkLogin } = require('../utils/authHandler');
let reservationController = require("../controllers/reservations");
let mongoose = require('mongoose');

// GET /reservations/ - get all reservations of current user
router.get("/", checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId; // Assuming req.userId is set by checkLogin
        let result = await reservationController.getAllReservations(userId);
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// GET /reservations/:id - get one reservation of current user
router.get("/:id", checkLogin, async function (req, res, next) {
    try {
        let userId = req.userId;
        let result = await reservationController.getReservationById(req.params.id, userId);
        if (result) {
            res.send(result);
        } else {
            res.status(404).send({ message: "Reservation not found" });
        }
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
});

// POST /reserveACart/ - reserve entire cart
router.post("/reserveACart", checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();
    try {
        let userId = req.userId;
        let result = await reservationController.reserveACart(userId, session);
        await session.commitTransaction();
        res.send(result);
    } catch (error) {
        await session.abortTransaction();
        res.status(400).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

// POST /reserveItems/ - reserve specific items
router.post("/reserveItems", checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();
    try {
        let userId = req.userId;
        let itemsData = req.body.items; // Array of { productId, quantity }
        let result = await reservationController.reserveItems(userId, itemsData, session);
        await session.commitTransaction();
        res.send(result);
    } catch (error) {
        await session.abortTransaction();
        res.status(400).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

// POST /cancelReserve/:id - cancel reservation
router.post("/cancelReserve/:id", checkLogin, async function (req, res, next) {
    let session = await mongoose.startSession();
    session.startTransaction();
    try {
        let userId = req.userId;
        let result = await reservationController.cancelReserve(req.params.id, userId, session);
        await session.commitTransaction();
        res.send(result);
    } catch (error) {
        await session.abortTransaction();
        res.status(400).send({ message: error.message });
    } finally {
        session.endSession();
    }
});

module.exports = router;