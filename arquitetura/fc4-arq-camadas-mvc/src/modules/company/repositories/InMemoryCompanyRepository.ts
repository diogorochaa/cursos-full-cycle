import {CompanyRepository} from "../../../interfaces/repositories/CompanyRepository";
import {Company} from "../models/Company";
import {CreateCompanyDTO} from "../dtos/CreateCompanyDTO";
import {UpdateCompanyDTO} from "../dtos/UpdateCompanyDTO";
import {NotFoundError} from "../../../shared/errors/AppError";
import {v4 as uuidv4} from "uuid";

export class InMemoryCompanyRepository implements CompanyRepository {
    private companies: Company[] = [];

    constructor() {
    }

    async create(createCompanyDTO: CreateCompanyDTO): Promise<Company> {
        const newCompany = {
            ...createCompanyDTO,
            id: uuidv4(),
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.companies.push(newCompany);

        return newCompany;
    }

    async delete(id: string): Promise<any> {
        const companyIndex = this.companies.findIndex(comp => comp.id === id)
        if (companyIndex === -1) {
            throw new NotFoundError(`Empresa com o id ${id} não foi encontrada`);
        }

        this.companies.splice(companyIndex, 1);
    }

    async findAll(): Promise<Company[]> {
        return [...this.companies];
    }

    async findByCNPJ(cnpj: string): Promise<Company | null> {
        return this.companies.find(company => company.cnpj === cnpj) || null;
    }

    async findByID(id: string): Promise<Company | null> {
        return this.companies.find(comp => comp.id === id) || null;
    }

    async update(id: string, updateCompanyDTO: UpdateCompanyDTO): Promise<Company> {
        const companyIndex = this.companies.findIndex(comp => comp.id === id)
        if (companyIndex === -1) {
            throw new NotFoundError(`Empresa com o id ${id} não foi encontrada`);
        }

        const updatedEmployee = {
            ...this.companies[companyIndex],
            ...updateCompanyDTO,
            updatedAt: new Date(),
        };

        this.companies[companyIndex] = updatedEmployee
        return updatedEmployee
    }
}