import express from 'express';
const router = express.Router();

import type { Request, Response, NextFunction } from "express";

/* GET home page. */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.render('index', { title: 'Hello from express v5 running in typescript' });
});

export default router;