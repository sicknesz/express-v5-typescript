// const mongoose = require('mongoose');
import mongoose, { model } from "mongoose";
import type { InferSchemaType, Document, Model } from 'mongoose'
import { Test } from "./Test.ts"
// import { accessibleRecordsPlugin } from "@casl/mongoose"

export interface IExercise {
  status: 'published' | 'draft' | 'unpublished' | 'moderated' | 'deleted';
  timeoutMs: number;
  name: string;
  requirements: string
  goal: string;
  score: number
  codeSnippets: string,
  testSnippets: string,
  tests: string[],
  publisherId: string;
}
export interface IExerciseDocument extends IExercise, Document { }
export interface IExerciseModel extends Model<Document> { }

const ExerciseSchema = new mongoose.Schema<IExercise>({
  status: {
    type: String,
    enum: [
      'published',
      'draft',
      'unpublished',
      'moderated',
      'deleted'
    ],
    // all new exercise starts as draft
    default: "draft"
  },
  timeoutMs: {
    type: Number,
    default: 5000
  },
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

// Using this allow to filter find query using accessibleBy(ability) - ability needs to add conditions for effective filtering (see documentation)

// ExerciseSchema.plugin(accessibleRecordsPlugin);


export type ExerciseAttributes = InferSchemaType<typeof ExerciseSchema>;
export const Exercise = model('Exercise', ExerciseSchema);