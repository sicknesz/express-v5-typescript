import mongoose from "mongoose"
import type { Request, Response } from "express"
import type { Model } from "mongoose"
// import type { IAccountDocument } from "../models/Account.ts";
// import type { IExerciseDocument } from "../models/Exercise.ts";
// import type { ITestDocument } from "../models/Test.ts";

type Entity = Model<any> // Model<IAccountDocument> | Model<IExerciseDocument> | Model<ITestDocument>;

const create = async (model: Entity, req: Request, res: Response) => {

  const result = await new model({
    ...req.body,
  }).save();

  if (!result) {
    return res.status(401).json({
      success: false,
      result: null,
      message: 'Unauthorized',
    });
  }

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
  }

  // Return success resposne
  return res.status(200).json({
    success: true,
    result,
    message: 'we found this document ',
  });
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

  }
  // Return success resposne
  return res.status(200).json({
    success: true,
    result,
    message: 'we found this document ',
  });
};

const update = async (model: Entity, req: Request, res: Response) => {
  const { params: { id: entityId } } = req;
  const queryOptions = { new: true, runValidators: true };
  const query = await model.findOneAndUpdate({ _id: entityId }, { $set: req.body }, queryOptions);
  const result = query.exec();

  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  }

  return res.status(200).json({
    success: true,
    result,
    message: 'we update this document ',
  });

};

const pagination = async (model: Entity, req: Request, res: Response) => {

  const {
    query: {
      page: pageString = "1",
      pageSize: pageSizeString = "50",
    },
  } = req;

  if (typeof pageString !== "string" || typeof pageSizeString !== "string") {
    return;
  }

  const page = parseInt(pageString, 10);
  const pageSize = parseInt(pageSizeString, 10);

  const paginatedQuery = isNaN(page) ? [] : [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }];

  const facetStage = {
    $facet: {
      metadata: [{ $count: "rowCount" }],
      users: paginatedQuery,
    },
  };

  const matchStage = { $match: {} };

  // FIXME: typescript error
  // const sortStage = { $sort: { "createdAt": 1 } };

  const aggregatePipeline = [matchStage/*, sortStage*/, facetStage];

  const [aggregate] = await model.aggregate(aggregatePipeline);
  if (aggregate.metadata.length === 0) {
    return res.status(200).json({
      entities: [],
      rowCount: 0,
    });
  }

  const { metadata: [{ rowCount }], entities = [] } = aggregate;
  return res.status(200).json({
    entities,
    rowCount,
  });

};

const remove = async (model: Entity, req: Request, res: Response) => {

  // Find the document by id and delete it
  const result = await model.findOneAndUpdate({ _id: req.params.id }, { $set: req.body }, { new: true }).exec();

  // If no results found, return document not found
  if (!result) {
    return res.status(404).json({
      success: false,
      result: null,
      message: 'No document found ',
    });
  }

  return res.status(200).json({
    success: true,
    result,
    message: 'Successfully Deleted the document ',
  });
};

function createCRUDController(modelName: string) {
  const model = mongoose.model(modelName);

  return {
    create: {
      path: `/api/${modelName.toLocaleLowerCase()}/`,
      handler: (req: Request, res: Response) => create(model as Model<any>, req, res)
    },
    // WIP : needs to be tested/debugged --- untested
    pagination: {
      path: `/api/${modelName.toLocaleLowerCase()}/`,
      handler: (req: Request, res: Response) => pagination(model as Model<any>, req, res)
    },
    readAll: {
      path: `/api/${modelName.toLocaleLowerCase()}/`,
      handler: (req: Request, res: Response) => readAll(model as Model<any>, req, res)
    },
    read: {
      path: `/api/${modelName.toLocaleLowerCase()}/:id`,
      handler: (req: Request, res: Response) => read(model as Model<any>, req, res)
    },
    update: {
      path: `/api/${modelName.toLocaleLowerCase()}/:id`,
      handler: (req: Request, res: Response) => update(model as Model<any>, req, res)
    },
    delete: {
      path: `/api/${modelName.toLocaleLowerCase()}/:id`,
      handler: (req: Request, res: Response) => remove(model as Model<any>, req, res)
    }
  }
}



export default createCRUDController