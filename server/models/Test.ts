// const mongoose = require('mongoose');
import mongoose, { model } from "mongoose";

const schema = new mongoose.Schema({
    name: {
        type: String,
    },
    sourceCode: {
        type: String,
    },
    expectedResult: {
        type: String,
    }
}, {
    timestamps: true
});

export const Test = model('Test', schema);