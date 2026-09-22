import { z } from 'zod';
import { AppError } from '../../../shared/errors/AppError';
import {CreateEmployeeDTO} from "../dtos/CreateEmployeeDTO";

const createEmployeeSchema = z.object({
    name: z.string().nonempty('Nome é obrigatório'),
    cpf: z.string().nonempty('CNPJ é obrigatório'),
    email: z.string().email('Email inválido'),
    position: z.string().nonempty('Cargo ou posição é obrigatório'),
    salary: z.number().nonnegative('Salário precisa ser maior do que 0'),
    companyId: z.string().nonempty('CompanyId é obrigatório').uuid(),
});

export async function validateCreateEmployee(input: any): Promise<CreateEmployeeDTO> {
    const result = createEmployeeSchema.safeParse(input);

    if (!result.success) {
        const errorMessage = result.error.errors[0]?.message || 'Dados inválidos';
        throw new AppError(errorMessage, 400);
    }

    return result.data;
}
