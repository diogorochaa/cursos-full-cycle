import { z } from 'zod';
import { AppError } from '../../../shared/errors/AppError';
import {UpdateEmployeeDTO} from "../dtos/UpdateEmployeeDTO";

const updateEmployeeSchema = z.object({
    salary: z.number().optional(),
    position: z.string().optional(),
});

export async function validateUpdateEmployee(input: any): Promise<UpdateEmployeeDTO> {
    const result = updateEmployeeSchema.safeParse(input);

    if (!result.success) {
        const errorMessage = result.error.errors[0]?.message || 'Dados inválidos';
        throw new AppError(errorMessage, 400);
    }

    return result.data;
}
