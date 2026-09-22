import {CompanyService} from "../../../interfaces/services/CompanyService";
import {CreateCompanyDTO} from "../dtos/CreateCompanyDTO";
import {undefined} from "zod";
import {UpdateCompanyDTO} from "../dtos/UpdateCompanyDTO";
import {Company} from "../models/Company";
import {CompanyRepository} from "../../../interfaces/repositories/CompanyRepository";
import {BadRequestError, ConflictError, NotFoundError} from "../../../shared/errors/AppError";
import {DocumentValidator} from "../../../shared/utils/documentValidator";

export class CompanyServiceImpl implements CompanyService {

    constructor(private readonly companyRepository: CompanyRepository) {
    }

    async create(createCompanyDTO: CreateCompanyDTO): Promise<Company> {
        if (!DocumentValidator.validateCNPJ(createCompanyDTO.cnpj)) {
            throw new BadRequestError("O CNPJ enviado é incorreto")
        }

        const existingCompany = await this.companyRepository.findByCNPJ(createCompanyDTO.cnpj)
        if (existingCompany) {
            throw new BadRequestError("O CNPJ enviado já pertence a outra empresa")
        }

        return await this.companyRepository.create(createCompanyDTO);
    }

    async delete(id: string): Promise<any> {
        const company = await this.companyRepository.findByID(id)
        if (!company) {
            throw new NotFoundError("Company doesn't exist");
        }

        return await this.companyRepository.delete(id);
    }

    async findAll(): Promise<Company[]> {
        return await this.companyRepository.findAll()
    }

    async findByCNPJ(cnpj: string): Promise<Company> {
        const company = await this.companyRepository.findByCNPJ(cnpj)
        if (!company) {
            throw new NotFoundError("Company doesn't exist");
        }

        return company
    }

    async findByID(id: string): Promise<Company | null> {
        const company = await this.companyRepository.findByID(id)
        if (!company) {
            throw new Error("Company doesn't exist");
        }

        return company
    }

    async update(id: string, updateCompanyDTO: UpdateCompanyDTO): Promise<Company> {
        const existingCompany = await this.companyRepository.findByID(id)
        if (!existingCompany) {
            throw new NotFoundError("O ID enviado não foi encontrado")
        }

        if (existingCompany.cnpj !== updateCompanyDTO.cnpj) {
            if (!DocumentValidator.validateCNPJ(updateCompanyDTO.cnpj)) {
                throw new BadRequestError("O CNPJ enviado é incorreto")
            }

            const company = await this.companyRepository.findByCNPJ(updateCompanyDTO.cnpj)
            if (company && company.id !== id) {
                throw new ConflictError("Outra empresa com este CNPJ já existe")
            }
        }

        return await this.companyRepository.update(id, updateCompanyDTO);
    }

}
