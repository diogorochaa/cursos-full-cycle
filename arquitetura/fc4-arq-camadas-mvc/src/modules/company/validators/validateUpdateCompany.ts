import {z} from 'zod';
import {UpdateCompanyDTO} from '../dtos/UpdateCompanyDTO';
import {AppError} from '../../../shared/errors/AppError';

const addressSchema = z.object({
    street: z.string().optional(),
    number: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
});

const updateCompanySchema = z.object({
    email: z.string().email('Email inválido').optional(),
    phone: z.string().optional(),
    cnpj: z.string(),
    address: addressSchema.optional(),
});

export function validateUpdateCompany(input: any): UpdateCompanyDTO {
    const result = updateCompanySchema.safeParse(input);

    if (!result.success) {
        const errorMessage = result.error.errors[0]?.message || 'Dados inválidos';
        throw new AppError(errorMessage, 400);
    }

    return result.data;
}
