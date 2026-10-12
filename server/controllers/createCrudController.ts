
import mongoose from "mongoose"
import type { Request, Response } from "express"
import type { Model } from "mongoose"

type Entity = Model<any, any, any, any, any, any >;

// FIXME : any
const create = async (model: Entity, req: Request, res: Response) => {

  const result = await new model({
    ...req.body,
  }).save();

  // Returning successfull response
  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully created the document of type',
  });
};

const read = async (model: Entity, req: Request, res: Response) => {

  // Find document by id
  const result = await model.findOne({ _id: req.params.id }).exec();

  // If no results found, return document not found
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });

  } else {
    // Return success resposne
    return res.status(200).json({
      success: true,
      result,
      message: 'we found this document ',
    });
  }
};

// Warning : use pagination on big collections
const readAll = async (model: Entity, req: Request, res: Response) => {

  // Find document by id
  const result = await model.findOne({}).exec();

  // If no results found, return document not found
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });

  } else {
    // Return success resposne
    return res.status(200).json({
      success: true,
      result,
      message: 'we found this document ',
    });
  }
};

const update = async (model: Entity, req: Request, res: Response) => {

  const result = await model.findOneAndUpdate(
    {
      _id: req.params.id
    },
    req.body,
    {
      new: true, // return the new result instead of the old one
      runValidators: true,
    }
  ).exec();

  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  } else {
    return res.status(200).json({
      success: true,
      result,
      message: 'we update this document ',
    });
  }
};

const remove = async (model: Entity, req: Request, res: Response) => {

  // Find the document by id and delete it
  const result = await model.findOneAndUpdate(
    {
      _id: req.params.id,
    },
    { $set: req.body },
    {
      new: true, // return the new result instead of the old one
    }
  ).exec();


  // If no results found, return document not found
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  } else {
    return res.status(200).json({
      success: true,
      result,
      message: 'Successfully Deleted the document ',
    });
  }
};

function createCRUDController(modelName: string) {
  const model = mongoose.model(modelName);

  return {
    create: { path: `/api/${modelName.toLocaleLowerCase()}/`, handler: (req: Request, res: Response) => create(model, req, res) },
    read: { path: `/api/${modelName.toLocaleLowerCase()}/:id`, handler: (req: Request, res: Response) => read(model, req, res) },
    readAll: { path: `/api/${modelName.toLocaleLowerCase()}/`, handler: (req: Request, res: Response) => readAll(model, req, res) },
    update: { path: `/api/${modelName.toLocaleLowerCase()}/:id`, handler: (req: Request, res: Response) => update(model, req, res) },
    delete: { path: `/api/${modelName.toLocaleLowerCase()}/:id`, handler: (req: Request, res: Response) => remove(model, req, res) },
  }

}

export default createCRUDController