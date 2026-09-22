import {CreateCompanyDTO} from "../../modules/company/dtos/CreateCompanyDTO";
import {Company} from "../../modules/company/models/Company";
import {UpdateCompanyDTO} from "../../modules/company/dtos/UpdateCompanyDTO";

export interface CompanyRepository {
    create(createCompanyDTO: CreateCompanyDTO): Promise<Company>;

    findAll(): Promise<Company[]>;

    findByCNPJ(cnpj: string): Promise<Company | null>;

    findByID(id: string): Promise<Company | null>;

    delete(id: string): Promise<any>;

    update(id: string, updateCompanyDTO: UpdateCompanyDTO): Promise<Company>;
}