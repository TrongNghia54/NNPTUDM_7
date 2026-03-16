let reservationModel = require("../schemas/reservations");
let cartModel = require("../schemas/carts");
let productModel = require("../schemas/products");
let mongoose = require('mongoose');

module.exports = {
    getAllReservations: async function (userId) {
        return await reservationModel.find({
            user: userId,
            isDeleted: false
        }).populate('items.product');
    },

    getReservationById: async function (id, userId) {
        return await reservationModel.findOne({
            _id: id,
            user: userId,
            isDeleted: false
        }).populate('items.product');
    },

    reserveACart: async function (userId, session) {
        // Get user's cart
        let cart = await cartModel.findOne({ user: userId }).populate('cartItems.product');
        if (!cart || cart.cartItems.length === 0) {
            throw new Error("Cart is empty");
        }

        // Calculate amount and create reservation items
        let items = [];
        let totalAmount = 0;
        for (let item of cart.cartItems) {
            let product = item.product;
            if (product.quantity < item.quantity) {
                throw new Error(`Insufficient stock for ${product.title}`);
            }
            let subtotal = product.price * item.quantity;
            totalAmount += subtotal;
            items.push({
                product: product._id,
                quantity: item.quantity,
                title: product.title,
                price: product.price,
                subtotal: subtotal
            });
        }

        // Create reservation
        let expiredIn = new Date();
        expiredIn.setMinutes(expiredIn.getMinutes() + 30); // Expire in 30 minutes

        let reservation = new reservationModel({
            user: userId,
            items: items,
            amount: totalAmount,
            expiredIn: expiredIn
        });

        await reservation.save({ session });

        // Update product quantities
        for (let item of items) {
            await productModel.updateOne(
                { _id: item.product },
                { $inc: { quantity: -item.quantity } },
                { session }
            );
        }

        // Clear cart
        await cartModel.updateOne(
            { user: userId },
            { $set: { cartItems: [] } },
            { session }
        );

        return reservation;
    },

    reserveItems: async function (userId, itemsData, session) {
        // itemsData is array of { productId, quantity }
        let items = [];
        let totalAmount = 0;

        for (let itemData of itemsData) {
            let product = await productModel.findById(itemData.productId);
            if (!product) {
                throw new Error(`Product ${itemData.productId} not found`);
            }
            if (product.quantity < itemData.quantity) {
                throw new Error(`Insufficient stock for ${product.title}`);
            }
            let subtotal = product.price * itemData.quantity;
            totalAmount += subtotal;
            items.push({
                product: product._id,
                quantity: itemData.quantity,
                title: product.title,
                price: product.price,
                subtotal: subtotal
            });
        }

        // Create reservation
        let expiredIn = new Date();
        expiredIn.setMinutes(expiredIn.getMinutes() + 30);

        let reservation = new reservationModel({
            user: userId,
            items: items,
            amount: totalAmount,
            expiredIn: expiredIn
        });

        await reservation.save({ session });

        // Update product quantities
        for (let item of items) {
            await productModel.updateOne(
                { _id: item.product },
                { $inc: { quantity: -item.quantity } },
                { session }
            );
        }

        return reservation;
    },

    cancelReserve: async function (id, userId, session) {
        let reservation = await reservationModel.findOne({
            _id: id,
            user: userId,
            status: "actived"
        });

        if (!reservation) {
            throw new Error("Reservation not found or not active");
        }

        // Restore product quantities
        for (let item of reservation.items) {
            await productModel.updateOne(
                { _id: item.product },
                { $inc: { quantity: item.quantity } },
                { session }
            );
        }

        // Update reservation status
        await reservationModel.updateOne(
            { _id: id },
            { $set: { status: "cancelled" } },
            { session }
        );

        return { message: "Reservation cancelled" };
    }
};