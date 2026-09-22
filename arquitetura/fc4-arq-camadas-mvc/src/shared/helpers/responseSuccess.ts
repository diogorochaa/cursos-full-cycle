import { Response } from 'express';

export function responseSuccess(res: Response, data: any, message = "Successo", status = 200) {
    return res.status(status).json({
        success: true,
        message,
        data,
    })
}