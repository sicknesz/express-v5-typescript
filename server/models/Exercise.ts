// const mongoose = require('mongoose');
import mongoose, { model } from "mongoose";
import { Test } from "./Test.ts"

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
    tests: [Test.schema],
    publisherId: {
        type: String
    }

}, {
    timestamps: true
});

export const Exercise = model('Exercise', schema);