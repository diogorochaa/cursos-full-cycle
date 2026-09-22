import { z } from 'zod';
import { CreateCompanyDTO } from '../dtos/CreateCompanyDTO';
import { AppError } from '../../../shared/errors/AppError';

const addressSchema = z.object({
    street: z.string().nonempty('Rua é obrigatória'),
    number: z.string().nonempty('Número é obrigatório'),
    city: z.string().nonempty('Cidade é obrigatória'),
    state: z.string().nonempty('Estado é obrigatório'),
    zipCode: z.string().nonempty('CEP é obrigatório'),
});

const createCompanySchema = z.object({
    name: z.string().nonempty('Nome é obrigatório'),
    cnpj: z.string().nonempty('CNPJ é obrigatório'),
    email: z.string().email('Email inválido').optional(),
    phone: z.string().optional(),
    address: addressSchema.optional(),
});

export function validateCreateCompany(input: any): CreateCompanyDTO {
    const result = createCompanySchema.safeParse(input);

    if (!result.success) {
        const errorMessage = result.error.errors[0]?.message || 'Dados inválidos';
        throw new AppError(errorMessage, 400);
    }

    return result.data;
}
