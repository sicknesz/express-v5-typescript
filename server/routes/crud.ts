import express from 'express';
const router = express.Router();

import type { Request, Response } from "express";

router.get('/crud/', (req: Request, res: Response) => {
    return res.json({ success: true, entity: [{}] });
});

router.get('/crud/:id', (req: Request, res: Response) => {
    if (Math.random() > 0.5) {
        return res.status(404).json({ success: false, message: "Not found" });
    }
    return res.json({ success: true, entities: {} });
});

router.post('/crud/', (req: Request, res: Response) => {
    if (Math.random() > 0.5) {
        return res.status(401).json({ success: false, message: "Not found" });
    }
    return res.status(201).json({ success: true, entity: {} });
});


router.put('/crud/:id', (req: Request, res: Response) => {
    if (Math.random() > 0.5) {
        return res.status(404).json({ success: false, message: "Not found" });
    }

    const allowed = Math.random() > 0.5;

    if (!allowed) {
        return res.status(401).json({ success: false, message: "unauthorized" });
    }

    return res.json({ success: true, entity: {} });
});

router.delete('/crud/:id', (req: Request, res: Response) => {
    if (Math.random() > 0.5) {
        return res.status(404).json({ success: false, message: "Not found" });
    }

    const allowed = Math.random() > 0.5;

    if (!allowed) {
        return res.status(401).json({ success: false, message: "unauthorized" });
    }

    return res.json({ success: true });
});

export default router;