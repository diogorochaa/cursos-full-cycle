export interface UpdateCompanyDTO {
    email?: string;
    phone?: string;
    cnpj: string;
    address?: {
        street?: string;
        number?: string;
        city?: string;
        state?: string;
        zipCode?: string;
    };
}
