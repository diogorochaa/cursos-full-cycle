import {NextFunction, Request, Response} from 'express';
import {validateCreateCompany} from "../validators/validateCreateCompany";
import {CompanyService} from "../../../interfaces/services/CompanyService";
import {responseSuccess} from "../../../shared/helpers/responseSuccess";
import {validateCNPJ} from "../validators/validateCnpj";
import {validateId} from "../../../shared/validators/validateId";
import {validateUpdateCompany} from "../validators/validateUpdateCompany";

export class CompanyController {

    constructor(private readonly companyService: CompanyService) {
    }

    async create(req: Request, res: Response, next: NextFunction): Promise<Response> {
        const data = validateCreateCompany(req.body);

        const company = await this.companyService.create(data);

        return responseSuccess(res, company, "Empresa criada com sucesso!", 201);
    }

    async findAll(req: Request, res: Response, next: NextFunction): Promise<Response> {
        const companies = await this.companyService.findAll()

        return responseSuccess(res, companies, "Empresas encontradas com sucesso!");
    }

    async findByCNPJ(req: Request, res: Response, next: NextFunction): Promise<Response> {
        const cnpj = validateCNPJ(req.params.cnpj);

        const company = await this.companyService.findByCNPJ(cnpj)

        return responseSuccess(res, company, "Empresa encontrada com sucesso!");
    }

    async findByID(req: Request, res: Response, next: NextFunction): Promise<Response> {
        const id = validateId(req.params.id);

        const company = await this.companyService.findByID(id)

        return responseSuccess(res, company, "Empresa encontrada com sucesso!");
    }

    async update(req: Request, res: Response, next: NextFunction): Promise<Response> {
        const id = validateId(req.params.id);
        const data = validateUpdateCompany(req.body);

        const company = await this.companyService.update(id, data)

        return responseSuccess(res, company, "Empresa atualizada com sucesso!");
    }

    async delete(req: Request, res: Response, next: NextFunction): Promise<Response> {
        const id = validateId(req.params.id);

        const company = await this.companyService.delete(id)

        return responseSuccess(res, company, "Empresa excluída com sucesso!");
    }
}
