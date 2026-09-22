import { z } from 'zod';
import { AppError } from "../../../shared/errors/AppError";

const cnpjSchema = z.string().min(14, "CNPJ deve ter no minimo 14 caracteres").nonempty("CNPJ é obrigatório");

export function validateCNPJ(cnpj: any): string {
    const result = cnpjSchema.safeParse(cnpj);

    if (!result.success) {
        const errorMessage = result.error.errors[0]?.message || 'CNPJ inválido';
        throw new AppError(errorMessage, 400);
    }

    return result.data;
}