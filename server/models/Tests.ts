// const mongoose = require('mongoose');
import mongoose from "mongoose";

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

export default schema;