// const mongoose = require('mongoose');
import mongoose, { model } from "mongoose";
import type { InferSchemaType, Model, Document } from 'mongoose'

export interface ITest {
  status: 'published' | 'draft' | 'unpublished' | 'moderated' | 'deleted';
  timeoutMs: number;
  name: string;
  sourceCode: string,
  expectedResult: string,
  publisherId: string;
}
export interface ITestDocument extends ITest, Document { }
export interface ITestModel extends Model<Document> { }

const TestSchema = new mongoose.Schema<ITest>({
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
  name: {
    type: String,
  },
  sourceCode: {
    type: String,
  },
  expectedResult: {
    type: String,
  },
  publisherId: {
    type: String
  }
},
  {
    timestamps: true
  });

export type TestAttributes = InferSchemaType<typeof TestSchema>;

export const Test = model('Test', TestSchema);