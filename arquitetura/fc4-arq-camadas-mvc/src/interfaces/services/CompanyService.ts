import {CreateCompanyDTO} from "../../modules/company/dtos/CreateCompanyDTO";
import {UpdateCompanyDTO} from "../../modules/company/dtos/UpdateCompanyDTO";
import {Company} from "../../modules/company/models/Company";

export interface CompanyService {
    create(createCompanyDTO: CreateCompanyDTO): Promise<Company>;

    findAll(): Promise<Company[]>;

    findByCNPJ(cnpj: string): Promise<Company>;

    findByID(id: string): Promise<Company | null>;

    delete(id: string): Promise<any>;

    update(id: string, updateCompanyDTO: UpdateCompanyDTO): Promise<Company>;
}