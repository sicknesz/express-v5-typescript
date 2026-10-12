// const mongoose = require('mongoose');
import mongoose from "mongoose";
import TestsSchema from "./Tests.ts"

const schema = new mongoose.Schema({
    name: {
        type: String,
    },
    requirements: {
        type: String,
    },
    goal: {
        type: String
    },
    score: {
        type: Number
    },
    codeSnippets: {
        type: String,
    },
    testSnippets: {
        type: String,
    },
    tests: [TestsSchema]

}, {
    timestamps: true
});

export default schema;