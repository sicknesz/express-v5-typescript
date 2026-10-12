import express from 'express';
import vm from "node:vm"
const router = express.Router();

import type { Request, Response, NextFunction } from "express";

/* GET users listing. */
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  res.send('respond with a resource');
});

router.post('/execute', (req: Request, res: Response, next: NextFunction) => {
  const { sourceCode, timeoutMs } = req.body;

  const context = {
    // see if we need this 
    ...process
  };

  const contextified = vm.createContext(context);

  const script = new vm.Script(sourceCode);

  const deadLine = Date.now() + timeoutMs;

  const result = script.runInContext(context, { 
    timeout: timeoutMs
  })

  res.send('respond with a resource');
});

export default router;
